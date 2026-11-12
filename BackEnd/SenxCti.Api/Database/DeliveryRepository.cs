using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace SenxCti.Api.Database;

public sealed record ReviewInput(Guid AnalysisId, Guid? Revision, string? Summary, int? Score, bool Validate);
public sealed record ReportInput(string? Title, string? Type, Guid? TeamId, string? Period, string? Summary, bool IncludeRanking = false);
public sealed record ActiveInput(bool Active);

public sealed class DeliveryRepository(DatabaseConnection database)
{
    public static bool ValidReview(ReviewInput input) => input.AnalysisId != Guid.Empty &&
        !string.IsNullOrWhiteSpace(input.Summary) && input.Summary.Length <= 20000 &&
        (input.Score is null or >= 0 and <= 100);
    public static readonly string[] Categories = ["Qualidade", "Retenção", "Desenvolvimento", "Conformidade"];
    public static readonly string[] Periods = ["Últimos 7 dias", "Últimos 30 dias", "Mês atual", "Trimestre atual"];
    public static bool ValidReport(ReportInput input) => !string.IsNullOrWhiteSpace(input.Title) &&
        input.Title.Trim().Length <= 200 && Categories.Contains(input.Type) && Periods.Contains(input.Period) &&
        (input.TeamId is null || input.TeamId != Guid.Empty) && (input.Summary?.Length ?? 0) <= 4000 &&
        (!input.IncludeRanking || input.Type == "Qualidade");

    // Serializa revisões da mesma ligação; não sobrescreve a saída original da IA.
    public async Task<int> Review(Guid callId, Guid reviewer, ReviewInput input, CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        await using var tx = await connection.BeginTransactionAsync(token);
        await using (var command = new NpgsqlCommand("""SELECT "IdLigacao" FROM public."Ligacao" WHERE "IdLigacao"=@id FOR UPDATE""", connection, tx))
        {
            command.Parameters.AddWithValue("id", callId);
            if (await command.ExecuteScalarAsync(token) is null) return 404;
        }
        await using (var command = new NpgsqlCommand("""SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id ORDER BY "Data_Analise" DESC,"IdAnalise" DESC LIMIT 1 FOR UPDATE""", connection, tx))
        {
            command.Parameters.AddWithValue("id", callId);
            if (await command.ExecuteScalarAsync(token) is not Guid latest || latest != input.AnalysisId) return 409;
        }
        await using (var command = new NpgsqlCommand("""SELECT "Revisao" FROM public."RevisaoHumana" WHERE "IdAnalise"=@id""", connection, tx))
        {
            command.Parameters.AddWithValue("id", input.AnalysisId);
            var previous = await command.ExecuteScalarAsync(token);
            if ((previous is Guid revision ? revision : (Guid?)null) != input.Revision) return 409;
        }
        await using (var command = new NpgsqlCommand("""
            INSERT INTO public."RevisaoHumana" ("IdAnalise","IdRevisor","Resumo","Score","Validado","Revisao")
            VALUES (@id,@reviewer,@summary,@score,@validated,@revision)
            ON CONFLICT ("IdAnalise") DO UPDATE SET "IdRevisor"=@reviewer,"Resumo"=@summary,
            "Score"=@score,"Validado"=@validated,"Revisao"=@revision,"AtualizadoEm"=now()
            """, connection, tx))
        {
            command.Parameters.AddWithValue("id", input.AnalysisId);
            command.Parameters.AddWithValue("reviewer", reviewer);
            command.Parameters.AddWithValue("summary", input.Summary!.Trim());
            command.Parameters.AddWithValue("score", NpgsqlDbType.Integer, (object?)input.Score ?? DBNull.Value);
            command.Parameters.AddWithValue("validated", input.Validate);
            command.Parameters.AddWithValue("revision", Guid.NewGuid());
            await command.ExecuteNonQueryAsync(token);
        }
        await tx.CommitAsync(token);
        return 200;
    }

    public async Task<int> SetActive(Guid id, Guid actor, bool active, CancellationToken token)
    {
        if (id == actor && !active) return 409;
        await using var connection = await database.OpenAsync(token);
        await using var tx = await connection.BeginTransactionAsync(token);
        await using (var locked = new NpgsqlCommand("""LOCK TABLE public."Usuario" IN EXCLUSIVE MODE""",connection,tx)) await locked.ExecuteNonQueryAsync(token);
        await using (var actorCheck = new NpgsqlCommand("""SELECT 1 FROM public."Usuario" WHERE "IdUsuario"=@id AND "Ativo" AND "Perfil"='Administrador'""",connection,tx))
        {
            actorCheck.Parameters.AddWithValue("id",actor);
            if (await actorCheck.ExecuteScalarAsync(token) is null) return 403;
        }
        await using var command = new NpgsqlCommand("""UPDATE public."Usuario" SET "Ativo"=@active,"VersaoAcesso"=gen_random_uuid() WHERE "IdUsuario"=@id""", connection,tx);
        command.Parameters.AddWithValue("active", active);
        command.Parameters.AddWithValue("id", id);
        var status = await command.ExecuteNonQueryAsync(token) == 0 ? 404 : 200;
        await tx.CommitAsync(token);
        return status;
    }

    public async Task<List<JsonElement>> Reports(CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        await using var command = new NpgsqlCommand("""SELECT "Conteudo"::text FROM public."Relatorio" ORDER BY "CriadoEm" DESC,"IdRelatorio" DESC LIMIT 1000""", connection);
        await using var reader = await command.ExecuteReaderAsync(token);
        var result = new List<JsonElement>();
        while (await reader.ReadAsync(token)) result.Add(JsonSerializer.Deserialize<JsonElement>(reader.GetString(0)));
        return result;
    }

    private static DateTime PeriodStart(string? period, DateTime today) => period switch
    {
        "Últimos 7 dias" => today.AddDays(-6), "Últimos 30 dias" => today.AddDays(-29),
        "Mês atual" => new DateTime(today.Year, today.Month, 1),
        _ => new DateTime(today.Year, ((today.Month - 1) / 3) * 3 + 1, 1)
    };

    public async Task<object> Ranking(Guid? teamId, Guid? userId, string period, CancellationToken token)
    {
        var today = DateTime.UtcNow.Date;
        var from = PeriodStart(period, today);
        await using var connection = await database.OpenAsync(token);
        var rows = await RankingRows(connection, null, teamId, userId, from, today.AddDays(1), token);
        return new { period = $"{from:dd/MM/yyyy} a {today:dd/MM/yyyy} (UTC)", rows };
    }

    private static async Task<List<object>> RankingRows(NpgsqlConnection connection, NpgsqlTransaction? tx,
        Guid? teamId, Guid? userId, DateTime from, DateTime until, CancellationToken token)
    {
        await using var command = new NpgsqlCommand("""
            WITH scores AS (
                SELECT u."IdUsuario" AS id, u."Nome" AS name, e."Nome" AS team,
                    count(l."IdLigacao") AS calls, count(s.score) AS evaluated,
                    count(l."IdLigacao") FILTER (
                        WHERE (a."IdAnalise" IS NULL OR a."Modelo_Versao" NOT ILIKE '%simulado%')
                        AND r."Validado" IS NOT TRUE) AS pending,
                    round(avg(s.score), 2) AS score,
                    round(avg(extract(epoch FROM l."Duracao")))::integer AS avg_seconds
                FROM public."Usuario" u
                JOIN public."Equipe" e ON e."IdEquipe"=u."IdEquipe"
                LEFT JOIN public."Ligacao" l ON l."IdFuncionario"=u."IdUsuario"
                    AND l."Data_Inicio">=@from AND l."Data_Inicio"<@until
                LEFT JOIN LATERAL (
                    SELECT a."IdAnalise", a."Modelo_Versao" FROM public."Analise" a
                    WHERE a."IdLigacao"=l."IdLigacao" ORDER BY a."Data_Analise" DESC,a."IdAnalise" DESC LIMIT 1
                ) a ON true
                LEFT JOIN public."RevisaoHumana" r ON r."IdAnalise"=a."IdAnalise"
                CROSS JOIN LATERAL (
                    SELECT CASE WHEN r."Validado" AND a."Modelo_Versao" NOT ILIKE '%simulado%' THEN r."Score" END AS score
                ) s
                WHERE (@team IS NULL OR u."IdEquipe"=@team) AND (@user IS NULL OR u."IdUsuario"=@user)
                GROUP BY u."IdUsuario", e."Nome"
                HAVING u."Perfil"='Colaborador' OR count(l."IdLigacao")>0
            )
            SELECT name, team, calls, evaluated, pending, score,
                CASE WHEN score IS NOT NULL AND @user IS NULL THEN rank() OVER (ORDER BY score DESC NULLS LAST) END,
                avg_seconds
            FROM scores ORDER BY score DESC NULLS LAST, name, id
            """, connection, tx);
        command.Parameters.AddWithValue("team", NpgsqlDbType.Uuid, (object?)teamId ?? DBNull.Value);
        command.Parameters.AddWithValue("user", NpgsqlDbType.Uuid, (object?)userId ?? DBNull.Value);
        command.Parameters.AddWithValue("from", NpgsqlDbType.Timestamp, DateTime.SpecifyKind(from, DateTimeKind.Unspecified));
        command.Parameters.AddWithValue("until", NpgsqlDbType.Timestamp, DateTime.SpecifyKind(until, DateTimeKind.Unspecified));
        await using var reader = await command.ExecuteReaderAsync(token);
        var rows = new List<object>();
        while (await reader.ReadAsync(token))
            rows.Add(new { name = reader.GetString(0), team = reader.GetString(1), calls = reader.GetInt64(2),
                evaluated = reader.GetInt64(3), pending = reader.GetInt64(4),
                score = reader.IsDBNull(5) ? (decimal?)null : reader.GetDecimal(5),
                position = reader.IsDBNull(6) ? (long?)null : reader.GetInt64(6),
                avgSeconds = reader.IsDBNull(7) ? (int?)null : reader.GetInt32(7) });
        return rows;
    }

    public async Task<Guid> CreateReport(Guid author, ReportInput input, CancellationToken token)
    {
        var today = DateTime.UtcNow.Date;
        var from = PeriodStart(input.Period, today);
        await using var connection = await database.OpenAsync(token);
        await using var tx = await connection.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, token);
        string team = "Todas as equipes";
        if (input.TeamId is Guid teamId)
        {
            await using var find = new NpgsqlCommand("""SELECT "Nome" FROM public."Equipe" WHERE "IdEquipe"=@id""", connection, tx);
            find.Parameters.AddWithValue("id", teamId);
            team = (string?)await find.ExecuteScalarAsync(token) ?? throw new KeyNotFoundException();
        }
        long total, analyzed, reviewed, simulated;
        double? averageScore, averageSeconds;
        await using (var command = new NpgsqlCommand("""
            SELECT count(*),count(a."IdAnalise") FILTER (WHERE a."Modelo_Versao" NOT ILIKE '%simulado%'),
              count(*) FILTER (WHERE r."Validado" AND a."Modelo_Versao" NOT ILIKE '%simulado%'),
              avg(COALESCE(r."Score",CASE WHEN a."Modelo_Versao" LIKE '%/sem-criterios' THEN NULL ELSE a."ScoreGeral" END)) FILTER (WHERE a."Modelo_Versao" NOT ILIKE '%simulado%'),
              avg(extract(epoch FROM l."Duracao")),count(*) FILTER (WHERE a."Modelo_Versao" ILIKE '%simulado%')
            FROM public."Ligacao" l JOIN public."Usuario" u ON u."IdUsuario"=l."IdFuncionario"
            LEFT JOIN LATERAL (SELECT * FROM public."Analise" a WHERE a."IdLigacao"=l."IdLigacao"
              ORDER BY a."Data_Analise" DESC,a."IdAnalise" DESC LIMIT 1) a ON true
            LEFT JOIN public."RevisaoHumana" r ON r."IdAnalise"=a."IdAnalise"
            WHERE l."Data_Inicio">=@from AND l."Data_Inicio"<@until AND (@team IS NULL OR u."IdEquipe"=@team)
            """, connection, tx))
        {
            command.Parameters.AddWithValue("from", NpgsqlDbType.Timestamp, DateTime.SpecifyKind(from,DateTimeKind.Unspecified));
            command.Parameters.AddWithValue("until", NpgsqlDbType.Timestamp, DateTime.SpecifyKind(today.AddDays(1),DateTimeKind.Unspecified));
            command.Parameters.AddWithValue("team", NpgsqlDbType.Uuid, (object?)input.TeamId ?? DBNull.Value);
            await using var reader = await command.ExecuteReaderAsync(token);
            await reader.ReadAsync(token);
            total = reader.GetInt64(0); analyzed = reader.GetInt64(1); reviewed = reader.GetInt64(2);
            averageScore = reader.IsDBNull(3) ? null : reader.GetDouble(3);
            averageSeconds = reader.IsDBNull(4) ? null : reader.GetDouble(4);
            simulated = reader.GetInt64(5);
        }
        var id = Guid.NewGuid();
        var generated = DateTimeOffset.UtcNow;
        var summary = $"Ligações: {total}. Com análise real: {analyzed}. Validadas por pessoa (análise real): {reviewed}. " +
            $"Demonstrações simuladas: {simulated} (excluídas das notas e dos totais de análise real). " +
            "Categoria organizacional; sem inferência automática. " + (input.Summary?.Trim() ?? "");
        var ranking = input.IncludeRanking ? await RankingRows(connection, tx, input.TeamId, null, from, today.AddDays(1), token) : null;
        var payload = JsonSerializer.Serialize(new {
            id, title = input.Title!.Trim(), type = input.Type, team, teamId = input.TeamId,
            criteria = "Indicadores descritivos dos registros", period = $"{from:dd/MM/yyyy} a {today:dd/MM/yyyy} (UTC)",
            from = from.ToString("yyyy-MM-dd"), until = today.ToString("yyyy-MM-dd"), date = today.ToString("yyyy-MM-dd"),
            status = "Gerado", score = averageScore is double score ? Math.Round(score,2).ToString("0.##",System.Globalization.CultureInfo.InvariantCulture) : "—",
            summary, total, analyzed, reviewed, simulated, averageScore, averageSeconds, generatedAt = generated,
            ranking
        });
        await using (var command = new NpgsqlCommand("""
            INSERT INTO public."Relatorio" ("IdRelatorio","IdAutor","Titulo","Categoria","IdEquipe","Conteudo")
            VALUES (@id,@author,@title,@category,@team,@content)
            """, connection, tx))
        {
            command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("author", author);
            command.Parameters.AddWithValue("title", input.Title.Trim()); command.Parameters.AddWithValue("category",input.Type!);
            command.Parameters.AddWithValue("team",NpgsqlDbType.Uuid,(object?)input.TeamId ?? DBNull.Value);
            command.Parameters.AddWithValue("content",NpgsqlDbType.Jsonb,payload);
            await command.ExecuteNonQueryAsync(token);
        }
        await tx.CommitAsync(token);
        return id;
    }

    public async Task<int> DeleteReport(Guid id, CancellationToken token)
    {
        if (id == Guid.Empty) return 400;
        await using var connection = await database.OpenAsync(token);
        await using var command = new NpgsqlCommand("""DELETE FROM public."Relatorio" WHERE "IdRelatorio"=@id""", connection);
        command.Parameters.AddWithValue("id", id);
        return await command.ExecuteNonQueryAsync(token) == 1 ? 204 : 404;
    }

    public async Task<string?> AudioPath(Guid callId, Guid? owner, CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        await using var command = new NpgsqlCommand("""SELECT "Caminho_Arquivo" FROM public."Ligacao" WHERE "IdLigacao"=@id AND (@owner IS NULL OR "IdFuncionario"=@owner)""",connection);
        command.Parameters.AddWithValue("id",callId);
        command.Parameters.AddWithValue("owner",NpgsqlDbType.Uuid,(object?)owner ?? DBNull.Value);
        return await command.ExecuteScalarAsync(token) as string;
    }

    public static string? ResolveAudio(string? root, string? stored)
    {
        if (string.IsNullOrWhiteSpace(root) || string.IsNullOrWhiteSpace(stored) || !Path.IsPathFullyQualified(root)) return null;
        try {
            root = Path.GetFullPath(root);
            var file = Path.GetFullPath(Path.Combine(root, stored));
            var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
            if (!file.StartsWith(Path.TrimEndingDirectorySeparator(root) + Path.DirectorySeparatorChar,comparison)) return null;
            for (var current = new FileInfo(file) as FileSystemInfo; current is not null; current = current is FileInfo f ? f.Directory : ((DirectoryInfo)current).Parent)
                if (current.Exists && (current.Attributes & FileAttributes.ReparsePoint) != 0) return null;
            return File.Exists(file) ? file : null;
        } catch (Exception error) when (error is ArgumentException or IOException or UnauthorizedAccessException) { return null; }
    }
}

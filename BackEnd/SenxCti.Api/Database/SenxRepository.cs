using Npgsql;

namespace SenxCti.Api.Database;

public sealed record TeamInput(string? Name, string? Department);
public sealed record CriterionInput(string? Name, string? Description, string? Rule, string? Version, bool Active);

// Consultas explícitas contra o dump oficial; nenhuma migração ou carga automática.
public sealed class SenxRepository(DatabaseConnection database)
{
    public static readonly string[] Tables = ["Equipe", "Usuario", "DadosCliente", "Ligacao", "Analise", "Assunto", "LigacaoAssunto", "Criterio", "Resultado", "Alerta", "Registro"];

    private async Task<NpgsqlConnection> Open(CancellationToken token)
    {
        return await database.OpenAsync(token);
    }

    private static async Task<List<Dictionary<string, object?>>> Rows(NpgsqlConnection connection, string sql, Guid? userId, CancellationToken token)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("userId", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)userId ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync(token);
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(token))
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++) row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            rows.Add(row);
        }
        return rows;
    }

    public async Task<object> Snapshot(Guid? userId, CancellationToken token)
    {
        await using var connection = await Open(token);
        await using var transaction = await connection.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, token);
        await using (var readOnly = new NpgsqlCommand("SET TRANSACTION READ ONLY", connection, transaction)) await readOnly.ExecuteNonQueryAsync(token);
        var counts = new Dictionary<string, long>();
        var scope = new Dictionary<string,string>
        {
            ["Equipe"] = """EXISTS (SELECT 1 FROM public."Usuario" u WHERE u."IdUsuario"=@userId AND u."IdEquipe"=t."IdEquipe")""",
            ["Usuario"] = """t."IdUsuario"=@userId""",
            ["DadosCliente"] = """EXISTS (SELECT 1 FROM public."Ligacao" l WHERE l."IdCliente"=t."IdDadosCliente" AND l."IdFuncionario"=@userId)""",
            ["Ligacao"] = """t."IdFuncionario"=@userId""",
            ["Analise"] = """EXISTS (SELECT 1 FROM public."Ligacao" l WHERE l."IdLigacao"=t."IdLigacao" AND l."IdFuncionario"=@userId)""",
            ["Assunto"] = """EXISTS (SELECT 1 FROM public."LigacaoAssunto" s JOIN public."Ligacao" l ON l."IdLigacao"=s."IdLigacao" WHERE s."IdAssunto"=t."IdAssunto" AND l."IdFuncionario"=@userId)""",
            ["LigacaoAssunto"] = """EXISTS (SELECT 1 FROM public."Ligacao" l WHERE l."IdLigacao"=t."IdLigacao" AND l."IdFuncionario"=@userId)""",
            ["Criterio"] = """t."Ativo" """,
            ["Resultado"] = """t."IdFuncionario"=@userId""", ["Alerta"] = """t."IdFuncionario"=@userId""",
            ["Registro"] = """t."IdFuncionario"=@userId"""
        };
        foreach (var table in Tables)
        {
            // Identificadores e condições vêm somente das listas fixas; valores são parâmetros.
            var sql = $"SELECT count(*) FROM public.\"{table}\" t" + (userId is null ? "" : " WHERE " + scope[table]);
            await using var command = new NpgsqlCommand(sql,connection,transaction);
            if (userId is not null) command.Parameters.AddWithValue("userId",userId.Value);
            counts[table] = (long)(await command.ExecuteScalarAsync(token))!;
        }
        var teams = await Rows(connection, """
            SELECT e."IdEquipe" AS id, e."Nome" AS name, e."Departamento" AS department,
              (SELECT count(*) FROM public."Usuario" u WHERE u."IdEquipe"=e."IdEquipe" AND (@userId IS NULL OR u."IdUsuario"=@userId)) AS members
            FROM public."Equipe" e WHERE (@userId IS NULL OR EXISTS (SELECT 1 FROM public."Usuario" me WHERE me."IdUsuario"=@userId AND me."IdEquipe"=e."IdEquipe")) ORDER BY e."Nome",e."IdEquipe" LIMIT 1000
            """, userId, token);
        var users = await Rows(connection, """
            SELECT u."IdUsuario" AS id,u."Nome" AS name,u."Email" AS email,u."Cargo" AS role,u."Perfil" AS profile,
              u."IdEquipe" AS "teamId",e."Nome" AS team
            FROM public."Usuario" u JOIN public."Equipe" e ON e."IdEquipe"=u."IdEquipe"
            WHERE (@userId IS NULL OR u."IdUsuario"=@userId)
            ORDER BY u."Nome",u."IdUsuario" LIMIT 1000
            """, userId, token);
        var criteria = await Rows(connection, """
            SELECT "IdCriterio" AS id,"Nome" AS name,"Descricao" AS description,
              "RegraAvaliacao" AS rule,"Versao" AS version,"Ativo" AS active
            FROM public."Criterio" WHERE (@userId IS NULL OR "Ativo") ORDER BY "Nome","IdCriterio" LIMIT 1000
            """, userId, token);
        var calls = await Rows(connection, """
            SELECT l."IdLigacao" AS id,c."Nome" AS client,c."Telefone" AS phone,u."Nome" AS agent,e."Nome" AS team,
              to_char(l."Data_Inicio",'YYYY-MM-DD') AS date,to_char(l."Data_Inicio",'HH24:MI') AS time,
              extract(epoch FROM l."Duracao")::integer AS seconds,l."Stats" AS status,l."IdentificadorPABX" AS "pabxId",
              (SELECT string_agg(s."Nome",', ' ORDER BY s."Nome") FROM public."LigacaoAssunto" ls
                JOIN public."Assunto" s ON s."IdAssunto"=ls."IdAssunto" WHERE ls."IdLigacao"=l."IdLigacao") AS topic,
              a."Resumo_Texto" AS summary,a."Transcricao_Texto" AS transcript,a."ResolucaoEncaminhamento" AS "nextStep",
              a."Compromissos" AS commitments,a."ScoreGeral" AS score,a."StatusProcessamento" AS processed
            FROM public."Ligacao" l JOIN public."DadosCliente" c ON c."IdDadosCliente"=l."IdCliente"
              JOIN public."Usuario" u ON u."IdUsuario"=l."IdFuncionario" JOIN public."Equipe" e ON e."IdEquipe"=u."IdEquipe"
              LEFT JOIN LATERAL (SELECT * FROM public."Analise" a WHERE a."IdLigacao"=l."IdLigacao"
                ORDER BY a."Data_Analise" DESC,a."IdAnalise" DESC LIMIT 1) a ON true
            WHERE (@userId IS NULL OR l."IdFuncionario"=@userId)
            ORDER BY l."Data_Inicio" DESC,l."IdLigacao" DESC LIMIT 200
            """, userId, token);
        await transaction.CommitAsync(token);
        return new { version = "0.1.4.2", source = "postgresql", teams, users, criteria, calls, counts,
            limits = new { teams = 1000, users = 1000, criteria = 1000, calls = 200 }, fetchedAt = DateTimeOffset.UtcNow };
    }

    public async Task<Guid?> SaveTeam(Guid? id, TeamInput input, CancellationToken token)
    {
        await using var connection = await Open(token);
        var sql = id is null ? """
            INSERT INTO public."Equipe" ("Nome","Departamento") VALUES (@name,@department) RETURNING "IdEquipe"
            """ : """
            UPDATE public."Equipe" SET "Nome"=@name,"Departamento"=@department WHERE "IdEquipe"=@id RETURNING "IdEquipe"
            """;
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("name", input.Name!.Trim());
        command.Parameters.AddWithValue("department", input.Department!.Trim());
        if (id is not null) command.Parameters.AddWithValue("id", id.Value);
        return (Guid?)await command.ExecuteScalarAsync(token);
    }

    public async Task<Guid?> SaveCriterion(Guid? id, CriterionInput input, CancellationToken token)
    {
        await using var connection = await Open(token);
        var sql = id is null ? """
            INSERT INTO public."Criterio" ("Nome","Descricao","RegraAvaliacao","Versao","Ativo")
            VALUES (@name,@description,@rule,@version,@active) RETURNING "IdCriterio"
            """ : """
            UPDATE public."Criterio" SET "Nome"=@name,"Descricao"=@description,"RegraAvaliacao"=@rule,"Versao"=@version,"Ativo"=@active
            WHERE "IdCriterio"=@id RETURNING "IdCriterio"
            """;
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("name", input.Name!.Trim());
        command.Parameters.AddWithValue("description", input.Description!.Trim());
        command.Parameters.AddWithValue("rule", input.Rule!.Trim());
        command.Parameters.AddWithValue("version", input.Version!.Trim());
        command.Parameters.AddWithValue("active", input.Active);
        if (id is not null) command.Parameters.AddWithValue("id", id.Value);
        return (Guid?)await command.ExecuteScalarAsync(token);
    }
}

using Npgsql;

namespace SenxCti.Api.Database;

public sealed record TeamInput(string? Name, string? Department);
public sealed record CriterionInput(string? Name, string? Description, string? Rule, string? Version, bool Active);
public sealed record CustomerInput(string? Name, string? Email, string? Phone, string? Status, bool Consent, Guid? UserId, Guid[]? UserIds = null);

// Consultas explícitas contra o dump oficial; nenhuma migração ou carga automática.
public sealed class SenxRepository(DatabaseConnection database, DeliveryRepository delivery)
{
    public static readonly string[] Tables = ["Equipe", "Usuario", "DadosCliente", "Ligacao", "Analise", "Assunto", "LigacaoAssunto", "Criterio", "Resultado", "Alerta", "Registro"];

    private async Task<NpgsqlConnection> Open(CancellationToken token)
    {
        return await database.OpenAsync(token);
    }

    private static async Task EnsureCustomerUsersAsync(NpgsqlConnection connection, CancellationToken token)
    {
        await using var cmd = new NpgsqlCommand("""
            CREATE TABLE IF NOT EXISTS public."ClienteUsuario" (
                "IdDadosCliente" uuid NOT NULL REFERENCES public."DadosCliente"("IdDadosCliente") ON DELETE CASCADE,
                "IdUsuario" uuid NOT NULL REFERENCES public."Usuario"("IdUsuario") ON DELETE CASCADE,
                PRIMARY KEY ("IdDadosCliente", "IdUsuario")
            );
            INSERT INTO public."ClienteUsuario" ("IdDadosCliente", "IdUsuario")
            SELECT "IdDadosCliente", "IdUsuario" FROM public."DadosCliente"
            UNION
            SELECT DISTINCT "IdCliente", "IdFuncionario" FROM public."Ligacao"
            ON CONFLICT DO NOTHING;
            """, connection);
        await cmd.ExecuteNonQueryAsync(token);
    }

    private static async Task<List<Dictionary<string, object?>>> Rows(NpgsqlConnection connection, string sql, Guid? userId, CancellationToken token, int limit = 200)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("userId", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)userId ?? DBNull.Value);
        command.Parameters.AddWithValue("limit", limit);
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

    public async Task<object> Snapshot(Guid? userId, CancellationToken token, int callLimit = 200)
    {
        callLimit = Math.Clamp(callLimit,200,10000);
        await using var connection = await Open(token);
        await EnsureCustomerUsersAsync(connection, token);
        await using var transaction = await connection.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, token);
        await using (var readOnly = new NpgsqlCommand("SET TRANSACTION READ ONLY", connection, transaction)) await readOnly.ExecuteNonQueryAsync(token);
        var counts = new Dictionary<string, long>();
        var scope = new Dictionary<string,string>
        {
            ["Equipe"] = """EXISTS (SELECT 1 FROM public."Usuario" u WHERE u."IdUsuario"=@userId AND u."IdEquipe"=t."IdEquipe")""",
            ["Usuario"] = """t."IdUsuario"=@userId""",
            ["DadosCliente"] = """t."IdUsuario"=@userId OR EXISTS (SELECT 1 FROM public."ClienteUsuario" cu WHERE cu."IdDadosCliente"=t."IdDadosCliente" AND cu."IdUsuario"=@userId) OR EXISTS (SELECT 1 FROM public."Ligacao" l WHERE l."IdCliente"=t."IdDadosCliente" AND l."IdFuncionario"=@userId)""",
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
              (SELECT count(*) FROM public."Usuario" u WHERE u."IdEquipe"=e."IdEquipe") AS members
            FROM public."Equipe" e ORDER BY e."Nome",e."IdEquipe" LIMIT 1000
            """, userId, token);
        var users = await Rows(connection, """
            SELECT u."IdUsuario" AS id,u."Nome" AS name,u."Email" AS email,u."Cargo" AS role,u."Perfil" AS profile,
              u."IdEquipe" AS "teamId",e."Nome" AS team,u."Ativo" AS active
            FROM public."Usuario" u JOIN public."Equipe" e ON e."IdEquipe"=u."IdEquipe"
            WHERE (@userId IS NULL OR u."IdUsuario"=@userId)
            ORDER BY u."Nome",u."IdUsuario" LIMIT 1000
            """, userId, token);
        var criteria = await Rows(connection, """
            SELECT "IdCriterio" AS id,"Nome" AS name,"Descricao" AS description,
              "RegraAvaliacao" AS rule,"Versao" AS version,"Ativo" AS active
            FROM public."Criterio" WHERE (@userId IS NULL OR "Ativo") ORDER BY "Nome","IdCriterio" LIMIT 1000
            """, userId, token);
        var customers = await Rows(connection, """
            SELECT c."IdDadosCliente" AS id, c."Nome" AS name, c."Email" AS email,
              c."Telefone" AS phone, c."Situacao" AS status, c."Consentimento" AS consent,
              c."IdUsuario" AS "userId",
              COALESCE((
                SELECT string_agg(
                  CASE WHEN sub.cnt > 0 THEN sub."Nome" || ' (' || sub.cnt || ')' ELSE sub."Nome" END,
                  ', ' ORDER BY sub.cnt DESC, sub."Nome"
                )
                FROM (
                  SELECT u2."IdUsuario", u2."Nome",
                    (SELECT count(*) FROM public."Ligacao" l2 WHERE l2."IdCliente"=c."IdDadosCliente" AND l2."IdFuncionario"=u2."IdUsuario") AS cnt
                  FROM public."Usuario" u2
                  WHERE u2."IdUsuario"=c."IdUsuario"
                    OR EXISTS (SELECT 1 FROM public."ClienteUsuario" cu WHERE cu."IdDadosCliente"=c."IdDadosCliente" AND cu."IdUsuario"=u2."IdUsuario")
                    OR EXISTS (SELECT 1 FROM public."Ligacao" l3 WHERE l3."IdCliente"=c."IdDadosCliente" AND l3."IdFuncionario"=u2."IdUsuario")
                ) sub
              ), u."Nome") AS agent,
              COALESCE((
                SELECT array_agg(sub."IdUsuario"::text ORDER BY sub."Nome")
                FROM (
                  SELECT DISTINCT u2."IdUsuario", u2."Nome"
                  FROM public."Usuario" u2
                  WHERE u2."IdUsuario"=c."IdUsuario"
                    OR EXISTS (SELECT 1 FROM public."ClienteUsuario" cu WHERE cu."IdDadosCliente"=c."IdDadosCliente" AND cu."IdUsuario"=u2."IdUsuario")
                    OR EXISTS (SELECT 1 FROM public."Ligacao" l3 WHERE l3."IdCliente"=c."IdDadosCliente" AND l3."IdFuncionario"=u2."IdUsuario")
                ) sub
              ), ARRAY[c."IdUsuario"::text]) AS "userIds",
              COALESCE((
                SELECT jsonb_object_agg(sub."IdUsuario"::text, sub.cnt)::text
                FROM (
                  SELECT u2."IdUsuario",
                    (SELECT count(*) FROM public."Ligacao" l2 WHERE l2."IdCliente"=c."IdDadosCliente" AND l2."IdFuncionario"=u2."IdUsuario") AS cnt
                  FROM public."Usuario" u2
                  WHERE u2."IdUsuario"=c."IdUsuario"
                    OR EXISTS (SELECT 1 FROM public."ClienteUsuario" cu WHERE cu."IdDadosCliente"=c."IdDadosCliente" AND cu."IdUsuario"=u2."IdUsuario")
                    OR EXISTS (SELECT 1 FROM public."Ligacao" l3 WHERE l3."IdCliente"=c."IdDadosCliente" AND l3."IdFuncionario"=u2."IdUsuario")
                ) sub
              ), '{}') AS "agentCallsJson",
              (SELECT count(*) FROM public."Ligacao" l WHERE l."IdCliente"=c."IdDadosCliente" AND (@userId IS NULL OR l."IdFuncionario"=@userId)) AS calls
            FROM public."DadosCliente" c
            LEFT JOIN public."Usuario" u ON u."IdUsuario"=c."IdUsuario"
            WHERE (@userId IS NULL OR c."IdUsuario"=@userId
              OR EXISTS (SELECT 1 FROM public."ClienteUsuario" cu WHERE cu."IdDadosCliente"=c."IdDadosCliente" AND cu."IdUsuario"=@userId)
              OR EXISTS (SELECT 1 FROM public."Ligacao" l WHERE l."IdCliente"=c."IdDadosCliente" AND l."IdFuncionario"=@userId))
            ORDER BY c."Nome", c."IdDadosCliente" LIMIT 1000
            """, userId, token);
        var calls = await Rows(connection, """
            SELECT l."IdLigacao" AS id,c."Nome" AS client,c."Telefone" AS phone,u."Nome" AS agent,e."Nome" AS team,
              to_char(l."Data_Inicio",'YYYY-MM-DD') AS date,to_char(l."Data_Inicio",'HH24:MI') AS time,
              extract(epoch FROM l."Duracao")::integer AS seconds,l."Stats" AS status,l."IdentificadorPABX" AS "pabxId",
              (SELECT string_agg(s."Nome",', ' ORDER BY s."Nome") FROM public."LigacaoAssunto" ls
                JOIN public."Assunto" s ON s."IdAssunto"=ls."IdAssunto" WHERE ls."IdLigacao"=l."IdLigacao") AS topic,
              COALESCE(r."Resumo",a."Resumo_Texto") AS summary,a."Transcricao_Texto" AS transcript,a."ResolucaoEncaminhamento" AS "nextStep",
              a."Compromissos" AS commitments,a."Modelo_Versao" AS model,COALESCE(r."Score",CASE WHEN a."Modelo_Versao" LIKE '%/sem-criterios' THEN NULL ELSE a."ScoreGeral" END) AS score,a."StatusProcessamento" AS processed,
              a."IdAnalise" AS "analysisId",r."Revisao" AS revision,COALESCE(r."Validado",false) AS reviewed,
              l."IdFuncionario" AS "agentId",NULLIF(l."Caminho_Arquivo",'') IS NOT NULL AS "hasAudio"
            FROM public."Ligacao" l JOIN public."DadosCliente" c ON c."IdDadosCliente"=l."IdCliente"
              JOIN public."Usuario" u ON u."IdUsuario"=l."IdFuncionario" JOIN public."Equipe" e ON e."IdEquipe"=u."IdEquipe"
              LEFT JOIN LATERAL (SELECT * FROM public."Analise" a WHERE a."IdLigacao"=l."IdLigacao"
                ORDER BY a."Data_Analise" DESC,a."IdAnalise" DESC LIMIT 1) a ON true
              LEFT JOIN public."RevisaoHumana" r ON r."IdAnalise"=a."IdAnalise"
            WHERE (@userId IS NULL OR l."IdFuncionario"=@userId)
            ORDER BY l."Data_Inicio" DESC,l."IdLigacao" DESC LIMIT @limit
            """, userId, token, callLimit);
        await transaction.CommitAsync(token);
        var reports = userId is null ? await delivery.Reports(token) : [];
        return new { version = "1.0.0.0", source = "postgresql", teams, users, criteria, customers, calls, counts, reports,
            limits = new { teams = 1000, users = 1000, criteria = 1000, customers = 1000, calls = callLimit }, fetchedAt = DateTimeOffset.UtcNow };
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

    public async Task<Guid?> SaveCustomer(Guid? id, Guid actorId, CustomerInput input, CancellationToken token)
    {
        await using var connection = await Open(token);
        await EnsureCustomerUsersAsync(connection, token);
        var selectedUsers = (input.UserIds ?? []).Where(u => u != Guid.Empty).Distinct().ToList();
        if (input.UserId is { } uid && uid != Guid.Empty && !selectedUsers.Contains(uid))
            selectedUsers.Insert(0, uid);
        if (selectedUsers.Count == 0)
            selectedUsers.Add(actorId);
        var ownerId = selectedUsers[0];
        await using var transaction = await connection.BeginTransactionAsync(token);
        var sql = id is null ? """
            INSERT INTO public."DadosCliente" ("IdUsuario","Nome","Email","Telefone","Situacao","Consentimento")
            VALUES (@userId,@name,@email,@phone,@status,@consent) RETURNING "IdDadosCliente"
            """ : """
            UPDATE public."DadosCliente" SET "IdUsuario"=@userId,"Nome"=@name,"Email"=@email,"Telefone"=@phone,"Situacao"=@status,"Consentimento"=@consent
            WHERE "IdDadosCliente"=@id RETURNING "IdDadosCliente"
            """;
        Guid? savedId;
        await using (var command = new NpgsqlCommand(sql, connection, transaction))
        {
            command.Parameters.AddWithValue("userId", ownerId);
            command.Parameters.AddWithValue("name", input.Name!.Trim());
            command.Parameters.AddWithValue("email", input.Email!.Trim());
            command.Parameters.AddWithValue("phone", input.Phone!.Trim());
            command.Parameters.AddWithValue("status", string.IsNullOrWhiteSpace(input.Status) ? "Ativo" : input.Status.Trim());
            command.Parameters.AddWithValue("consent", input.Consent);
            if (id is not null) command.Parameters.AddWithValue("id", id.Value);
            savedId = (Guid?)await command.ExecuteScalarAsync(token);
        }
        if (savedId is null) return null;
        await using (var clear = new NpgsqlCommand("""DELETE FROM public."ClienteUsuario" WHERE "IdDadosCliente"=@id""", connection, transaction))
        {
            clear.Parameters.AddWithValue("id", savedId.Value);
            await clear.ExecuteNonQueryAsync(token);
        }
        foreach (var memberId in selectedUsers)
        {
            await using var link = new NpgsqlCommand("""
                INSERT INTO public."ClienteUsuario" ("IdDadosCliente", "IdUsuario")
                VALUES (@customerId, @userId) ON CONFLICT DO NOTHING
                """, connection, transaction);
            link.Parameters.AddWithValue("customerId", savedId.Value);
            link.Parameters.AddWithValue("userId", memberId);
            await link.ExecuteNonQueryAsync(token);
        }
        await transaction.CommitAsync(token);
        return savedId;
    }
}

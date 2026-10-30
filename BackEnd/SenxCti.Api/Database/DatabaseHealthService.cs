using Npgsql;

namespace SenxCti.Api.Database;

public sealed record TableHealth(string Name, bool Exists, bool CanRead, bool CanInsert, bool CanUpdate, string[] MissingColumns);
public sealed record DatabaseHealthResult(string Status, string Detail, long? LatencyMs = null,
    string? Database = null, string? User = null, string? ServerVersion = null, TableHealth[]? Tables = null);

public sealed class DatabaseHealthService(DatabaseConnection database, ILogger<DatabaseHealthService> logger)
{
    // Colunas consumidas pelo repositório; os valores de senha nunca são retornados.
    private static readonly Dictionary<string, string[]> Required = new()
    {
        ["Equipe"] = ["IdEquipe", "Nome", "Departamento"],
        ["Usuario"] = ["IdUsuario", "IdEquipe", "Nome", "Email", "Cargo", "Perfil", "Senha", "Ativo", "VersaoAcesso"],
        ["RevisaoHumana"] = ["IdAnalise", "IdRevisor", "Resumo", "Score", "Validado", "Revisao", "AtualizadoEm"],
        ["Relatorio"] = ["IdRelatorio", "IdAutor", "Titulo", "Categoria", "IdEquipe", "Conteudo", "CriadoEm"],
        ["DadosCliente"] = ["IdDadosCliente", "Nome", "Telefone"],
        ["Ligacao"] = ["IdLigacao", "IdCliente", "IdFuncionario", "Data_Inicio", "Duracao", "Stats", "IdentificadorPABX"],
        ["Analise"] = ["IdAnalise", "IdLigacao", "Data_Analise", "Resumo_Texto", "Transcricao_Texto", "ResolucaoEncaminhamento", "Compromissos", "ScoreGeral", "StatusProcessamento"],
        ["Assunto"] = ["IdAssunto", "Nome"],
        ["LigacaoAssunto"] = ["IdLigacao", "IdAssunto"],
        ["Criterio"] = ["IdCriterio", "Nome", "Descricao", "RegraAvaliacao", "Versao", "Ativo"],
        ["Resultado"] = ["IdResultado"], ["Alerta"] = ["IdAlerta"], ["Registro"] = ["IdRegistro"]
    };

    public async Task<DatabaseHealthResult> CheckAsync(CancellationToken token)
    {
        var start = Environment.TickCount64;
        try
        {
            await using var connection = await database.OpenAsync(token);
            await using var command = new NpgsqlCommand("""
                SELECT c.relname, a.attname,
                    has_table_privilege(c.oid, 'SELECT'), has_table_privilege(c.oid, 'INSERT'), has_table_privilege(c.oid, 'UPDATE'),
                    has_schema_privilege(n.oid, 'USAGE')
                FROM pg_catalog.pg_class c
                JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
                WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY(@tables)
                """, connection);
            command.Parameters.AddWithValue("tables", Required.Keys.ToArray());
            var columns = new Dictionary<string, HashSet<string>>();
            var permissions = new Dictionary<string, (bool Read, bool Insert, bool Update)>();
            await using (var reader = await command.ExecuteReaderAsync(token))
            {
                while (await reader.ReadAsync(token))
                {
                    var name = reader.GetString(0);
                    if (!columns.TryGetValue(name, out var found)) columns[name] = found = [];
                    if (!reader.IsDBNull(1)) found.Add(reader.GetString(1));
                    var schema = reader.GetBoolean(5);
                    permissions[name] = (schema && reader.GetBoolean(2), schema && reader.GetBoolean(3), schema && reader.GetBoolean(4));
                }
            }
            var tables = Required.Select(pair =>
            {
                var exists = columns.TryGetValue(pair.Key, out var found);
                var access = permissions.GetValueOrDefault(pair.Key);
                return new TableHealth(pair.Key, exists, access.Read, access.Insert, access.Update,
                    pair.Value.Where(column => found is null || !found.Contains(column)).ToArray());
            }).ToArray();
            var schemaOk = tables.All(t => t.Exists && t.MissingColumns.Length == 0);
            var accessOk = tables.All(t => t.CanRead) && tables.Where(t => t.Name is "Equipe" or "Criterio" or "Usuario" or "RevisaoHumana" or "Relatorio").All(t => t.CanInsert && t.CanUpdate);
            var status = !schemaOk ? "schema_mismatch" : !accessOk ? "permission_denied" : "ok";
            var detail = !schemaOk ? "Esquema incompleto. Confira as tabelas e colunas do senx.sql." : !accessOk ?
                "Permissões insuficientes: leitura das tabelas e INSERT/UPDATE em Equipe, Criterio e Usuario são necessários." :
                "Conexão, esquema e permissões do PostgreSQL validados.";
            return new(status, detail, Environment.TickCount64-start, connection.Database, connection.UserName, connection.PostgreSqlVersion.ToString(), tables);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is NpgsqlException or TimeoutException or ArgumentException || error is InvalidOperationException { Message: "database_not_configured" })
        {
            // Somente o código é registrado, nunca a conexão ou parâmetros secretos.
            var status = error switch
            {
                InvalidOperationException => "not_configured",
                ArgumentException => "invalid_configuration",
                PostgresException { SqlState: "28P01" or "28000" } => "authentication_failed",
                PostgresException { SqlState: "3D000" } => "database_not_found",
                PostgresException { SqlState: "42501" } => "permission_denied",
                _ => "unavailable"
            };
            logger.LogWarning("Verificação PostgreSQL: {Status}", status);
            var detail = status switch
            {
                "not_configured" => "Defina SENX_DB_CONNECTION em appsettings.Local.json ou no ambiente.",
                "invalid_configuration" => "Revise o formato da configuração SENX_DB_CONNECTION.",
                "authentication_failed" => "Usuário ou senha inválidos. Confira a configuração local e reinicie a API.",
                "database_not_found" => "O banco configurado não existe neste servidor.",
                "permission_denied" => "O usuário não tem as permissões necessárias no banco.",
                _ => "PostgreSQL indisponível. Confira o serviço, o host e a porta."
            };
            return new(status, detail, Environment.TickCount64-start);
        }
    }
}

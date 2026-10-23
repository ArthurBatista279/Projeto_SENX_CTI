using Npgsql;

namespace SenxCti.Api.Database;

public sealed record DatabaseHealthResult(string Status, string Detail, long? LatencyMs = null);

public sealed class DatabaseHealthService(IConfiguration configuration, ILogger<DatabaseHealthService> logger)
{
    public async Task<DatabaseHealthResult> CheckAsync(CancellationToken cancellationToken)
    {
        var connectionString = configuration["SENX_DB_CONNECTION"];
        if (string.IsNullOrWhiteSpace(connectionString))
            return new("not_configured", "Defina SENX_DB_CONNECTION para habilitar o teste do PostgreSQL.");

        var startedAt = Environment.TickCount64;
        try
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = new NpgsqlCommand("SELECT 1", connection);
            await command.ExecuteScalarAsync(cancellationToken);
            return new("ok", "Conexão com PostgreSQL validada.", Environment.TickCount64 - startedAt);
        }
        catch (Exception exception) when (exception is NpgsqlException or TimeoutException)
        {
            logger.LogWarning(exception, "Falha no teste de conexão com PostgreSQL.");
            return new("unavailable", "Não foi possível conectar ao PostgreSQL.", Environment.TickCount64 - startedAt);
        }
    }
}

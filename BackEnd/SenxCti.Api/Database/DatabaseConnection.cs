using Npgsql;

namespace SenxCti.Api.Database;

// Uma fonte compartilhada mantém o pool; cada operação devolve sua conexão ao terminar.
public sealed class DatabaseConnection(IConfiguration configuration) : IAsyncDisposable
{
    private readonly Lazy<NpgsqlDataSource> source = new(() =>
    {
        var value = configuration["SENX_DB_CONNECTION"];
        if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException("database_codecodenot_configured");
        var settings = new NpgsqlConnectionStringBuilder(value)
        {
            Timeout = 5, CommandTimeout = 10, ApplicationName = "SENX CTI 0.1.4.2",
            IncludeErrorDetail = false
        };
        return NpgsqlDataSource.Create(settings.ConnectionString);
    });

    public ValueTask<NpgsqlConnection> OpenAsync(CancellationToken token) => source.Value.OpenConnectionAsync(token);

    public async ValueTask DisposeAsync()
    {
        if (source.IsValueCreated) await source.Value.DisposeAsync();
    }
}

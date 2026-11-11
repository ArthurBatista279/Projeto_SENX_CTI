using Npgsql;

namespace SenxCti.Api.Database;

// Uma fonte compartilhada mantém o pool; cada operação devolve sua conexão ao terminar.
public sealed class DatabaseConnection(IConfiguration configuration) : IAsyncDisposable
{
    private readonly Lazy<NpgsqlDataSource> source = new(() =>
    {
        var value = configuration["SENX_DB_CONNECTION"];
        if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException("database_not_configured");
        var settings = CreateSettings(value);
        settings.Timeout = 5;
        settings.CommandTimeout = 10;
        settings.ApplicationName = "SENX CTI 1.5.0.0";
        settings.IncludeErrorDetail = false;
        return NpgsqlDataSource.Create(settings.ConnectionString);
    });

    public static NpgsqlConnectionStringBuilder CreateSettings(string value)
    {
        var trimmed = value.Trim();
        NpgsqlConnectionStringBuilder builder;
        if (trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(trimmed);
            var userInfo = uri.UserInfo.Split(':', 2);
            var ssl = SslMode.Require;
            if (uri.Query.Contains("sslmode=disable", StringComparison.OrdinalIgnoreCase)) ssl = SslMode.Disable;
            else if (uri.Query.Contains("sslmode=allow", StringComparison.OrdinalIgnoreCase) ||
                     uri.Query.Contains("sslmode=prefer", StringComparison.OrdinalIgnoreCase)) ssl = SslMode.Prefer;

            builder = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.Port > 0 ? uri.Port : 5432,
                Username = Uri.UnescapeDataString(userInfo[0]),
                Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
                Database = uri.AbsolutePath.TrimStart('/'),
                SslMode = ssl
            };
        }
        else
        {
            builder = new NpgsqlConnectionStringBuilder(trimmed);
        }

        builder.ChannelBinding = ChannelBinding.Disable;
        return builder;
    }

    public ValueTask<NpgsqlConnection> OpenAsync(CancellationToken token) => source.Value.OpenConnectionAsync(token);

    public async ValueTask DisposeAsync()
    {
        if (source.IsValueCreated) await source.Value.DisposeAsync();
    }
}

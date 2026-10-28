using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using SenxCti.Api.Data;

internal static class DatabaseReadOnly
{
    public static async Task<int> Check()
    {
        var apiPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../SenxCti.Api"));
        var configuration = new ConfigurationBuilder().SetBasePath(apiPath)
            .AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables().Build();
        var connection = configuration["SENX_DB_CONNECTION"];
        if (string.IsNullOrWhiteSpace(connection))
        {
            Console.WriteLine("FALTA: SENX_DB_CONNECTION no ambiente ou em SenxCti.Api/appsettings.Local.json.");
            return 1;
        }
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            await using var db = new SenxContext(new DbContextOptionsBuilder<SenxContext>().UseNpgsql(connection).Options);
            await using var transaction = await db.Database.BeginTransactionAsync(timeout.Token);
            await db.Database.ExecuteSqlRawAsync("SET TRANSACTION READ ONLY", timeout.Token);
            await using (var schema = db.Database.GetDbConnection().CreateCommand())
            {
                schema.CommandText = "SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name='Usuario' ORDER BY ordinal_position";
                schema.Transaction = transaction.GetDbTransaction();
                await using var reader = await schema.ExecuteReaderAsync(timeout.Token);
                while (await reader.ReadAsync(timeout.Token))
                    Console.WriteLine($"SCHEMA Usuario.{reader.GetString(0)}: {reader.GetString(1)} {reader.GetValue(2)}");
            }
            // Materializa no máximo uma linha por entidade, sem imprimir dados pessoais.
            foreach (var entity in db.Model.GetEntityTypes().Where(e => e.ClrType.Namespace == "SenxCti.Api.Models"))
            {
                var method = typeof(DatabaseReadOnly).GetMethod(nameof(Read), System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic)!;
                await (Task)method.MakeGenericMethod(entity.ClrType).Invoke(null, [db, timeout.Token])!;
                Console.WriteLine("PASS: PostgreSQL / EF " + entity.GetTableName());
            }
            await transaction.RollbackAsync(timeout.Token);
            return 0;
        }
        catch (Exception error)
        {
            var cause = error.GetBaseException();
            Console.WriteLine("FAIL: PostgreSQL somente leitura: " + cause.GetType().Name +
                (cause is Npgsql.PostgresException pg ? " SQLSTATE=" + pg.SqlState : "") +
                ". Confira conexão, serviço, esquema 0.1.4 e permissão SELECT. Nenhum dado foi alterado.");
            return 1;
        }
    }

    private static async Task Read<T>(SenxContext db, CancellationToken token) where T : class =>
        _ = await db.Set<T>().AsNoTracking().Take(1).ToListAsync(token);
}

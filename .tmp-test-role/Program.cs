using Microsoft.Extensions.Configuration;
using Npgsql;
using SenxCti.Api.Database;

var config = new ConfigurationBuilder().SetBasePath(Path.GetFullPath("BackEnd/SenxCti.Api"))
    .AddJsonFile("appsettings.Local.json", true).AddEnvironmentVariables().Build();
await using var database = new DatabaseConnection(config);
await using var connection = await database.OpenAsync(default);
await using var transaction = await connection.BeginTransactionAsync();
await using var command = new NpgsqlCommand("""
    UPDATE public."Usuario" SET "Perfil"='Administrador', "VersaoAcesso"=gen_random_uuid()
    WHERE lower(btrim("Email"))=@email
    RETURNING "Perfil"
    """, connection, transaction);
command.Parameters.AddWithValue("email", "teste@gmail.com");
await using (var reader = await command.ExecuteReaderAsync())
{
    if (!await reader.ReadAsync() || reader.GetString(0) != "Administrador")
        throw new InvalidOperationException("Conta nao encontrada.");
    if (await reader.ReadAsync()) throw new InvalidOperationException("Email duplicado; alteracao cancelada.");
}
await transaction.CommitAsync();
Console.WriteLine("Perfil confirmado: teste@gmail.com | Administrador");

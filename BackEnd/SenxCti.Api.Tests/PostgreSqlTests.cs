using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace SenxCti.Api.Tests;

public sealed class DatabaseFactAttribute : FactAttribute
{
    public DatabaseFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("SENX_RUN_DATABASE_TESTS") != "1")
            Skip = "Teste PostgreSQL explícito: defina SENX_RUN_DATABASE_TESTS=1 no ambiente local configurado.";
    }
}

public sealed class PostgreSqlTests
{
    [DatabaseFact]
    public async Task RealDatabase_CreateUpdateReloadAndCleanup()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.WithWebHostBuilder(b => b.UseEnvironment("Development")).CreateClient();
        var connectionString = factory.Services.GetRequiredService<IConfiguration>()["SENX_DB_CONNECTION"];
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        Guid? teamId = null, criterionId = null;
        try
        {
            var marker = "QA-" + Guid.NewGuid();
            var teamResponse = await client.PostAsJsonAsync("/api/data/teams", new { name = marker, department = "Verificação temporária" });
            Assert.Equal(HttpStatusCode.Created, teamResponse.StatusCode);
            teamId = (await teamResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
            var update = await client.PutAsJsonAsync($"/api/data/teams/{teamId}", new { name = marker + " atualizado", department = "D'Ávila; SELECT 1" });
            Assert.Equal(HttpStatusCode.OK, update.StatusCode);
            var criterionResponse = await client.PostAsJsonAsync("/api/data/criteria", new { name = marker, description = "Descrição de teste", rule = "Regra temporária", version = "0.1.2", active = true });
            Assert.Equal(HttpStatusCode.Created, criterionResponse.StatusCode);
            criterionId = (await criterionResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
            var change = await client.PutAsJsonAsync($"/api/data/criteria/{criterionId}", new { name = marker, description = "Atualizada", rule = "Regra temporária", version = "0.1.2", active = false });
            Assert.Equal(HttpStatusCode.OK, change.StatusCode);
            var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/data/snapshot");
            Assert.Equal("postgresql", snapshot.GetProperty("source").GetString());
            Assert.Contains(snapshot.GetProperty("teams").EnumerateArray(), t => t.GetProperty("id").GetGuid() == teamId && t.GetProperty("department").GetString() == "D'Ávila; SELECT 1");
            Assert.Contains(snapshot.GetProperty("criteria").EnumerateArray(), c => c.GetProperty("id").GetGuid() == criterionId && !c.GetProperty("active").GetBoolean());
            Assert.DoesNotContain("senha", snapshot.GetRawText().ToLowerInvariant());
            Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"/api/data/teams/{Guid.NewGuid()}", new { name = marker, department = "QA" })).StatusCode);
        }
        finally
        {
            foreach (var (table, column, id) in new[] { ("Criterio", "IdCriterio", criterionId), ("Equipe", "IdEquipe", teamId) })
            {
                if (id is null) continue;
                await using var command = new NpgsqlCommand($"DELETE FROM public.\"{table}\" WHERE \"{column}\"=@id", connection);
                command.Parameters.AddWithValue("id", id.Value);
                await command.ExecuteNonQueryAsync();
            }
        }
    }
}

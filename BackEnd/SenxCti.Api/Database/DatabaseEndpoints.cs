using System.Net;
using Npgsql;

namespace SenxCti.Api.Database;

public static class DatabaseEndpoints
{
    public static void MapDatabaseTests(this WebApplication app)
    {
        // Não existe autenticação de produto nesta versão; testes somente locais em Development.
        if (!app.Environment.IsDevelopment()) return;
        var group = app.MapGroup("/api/data");
        group.AddEndpointFilter(async (context, next) =>
        {
            var remote = context.HttpContext.Connection.RemoteIpAddress;
            if (remote is not null && !IPAddress.IsLoopback(remote)) return Results.StatusCode(403);
            try { return await next(context); }
            catch (PostgresException exception) when (exception.SqlState is "23505" or "23503")
            { return Results.Problem("Registro duplicado ou vínculo inválido no banco.", statusCode:409); }
            catch (Exception exception) when (exception is NpgsqlException or TimeoutException || exception is InvalidOperationException { Message: "database_not_configured" })
            {
                var detail = exception is InvalidOperationException ? "Configure SENX_DB_CONNECTION para conectar ao PostgreSQL." :
                    exception is PostgresException { SqlState: "42P01" or "42703" } ? "O esquema do banco não corresponde ao senx.sql. Confira a importação." :
                    "Não foi possível consultar o PostgreSQL. Confira a conexão local e as permissões.";
                return Results.Problem(detail, statusCode:503);
            }
        });
        group.MapGet("/snapshot", async (SenxRepository repository, CancellationToken token) => Results.Ok(await repository.Snapshot(token)));
        group.MapPost("/teams", async (TeamInput input, SenxRepository repository, CancellationToken token) =>
        {
            if (!Valid(input.Name, 255) || !Valid(input.Department, 255)) return Results.Problem("Nome e departamento são obrigatórios e devem ter até 255 caracteres.", statusCode:400);
            var id = await repository.SaveTeam(null,input,token);
            return Results.Created($"/api/data/teams/{id}", new { id });
        });
        group.MapPut("/teams/{id:guid}", async (Guid id, TeamInput input, SenxRepository repository, CancellationToken token) =>
        {
            if (!Valid(input.Name,255) || !Valid(input.Department,255)) return Results.Problem("Nome e departamento são obrigatórios e devem ter até 255 caracteres.", statusCode:400);
            return await repository.SaveTeam(id,input,token) is null ? Results.NotFound() : Results.Ok(new { id });
        });
        group.MapPost("/criteria", async (CriterionInput input, SenxRepository repository, CancellationToken token) =>
        {
            if (!ValidCriterion(input)) return Results.Problem("Preencha nome, descrição, regra e versão, com até 255 caracteres cada.", statusCode:400);
            var id = await repository.SaveCriterion(null,input,token);
            return Results.Created($"/api/data/criteria/{id}",new { id });
        });
        group.MapPut("/criteria/{id:guid}", async (Guid id, CriterionInput input, SenxRepository repository, CancellationToken token) =>
        {
            if (!ValidCriterion(input)) return Results.Problem("Preencha nome, descrição, regra e versão, com até 255 caracteres cada.", statusCode:400);
            return await repository.SaveCriterion(id,input,token) is null ? Results.NotFound() : Results.Ok(new { id });
        });
    }
    private static bool Valid(string? value,int length) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= length;
    private static bool ValidCriterion(CriterionInput value) => Valid(value.Name,255) && Valid(value.Description,255) && Valid(value.Rule,255) && Valid(value.Version,255);
}

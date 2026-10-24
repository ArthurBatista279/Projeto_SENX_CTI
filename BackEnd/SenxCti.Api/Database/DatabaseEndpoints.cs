using System.Security.Claims;
using SenxCti.Api.Auth;

namespace SenxCti.Api.Database;

public static class DatabaseEndpoints
{
    public static void MapDatabaseEndpoints(this WebApplication app)
    {
        // A versão continua local; autenticação e autorização são obrigatórias.
        if (!app.Environment.IsDevelopment()) return;
        var group = app.MapGroup("/api/data").RequireAuthorization();
        group.MapGet("/snapshot", async (HttpContext context, SenxRepository repository, CancellationToken token) => Results.Ok(await repository.Snapshot(context.User.IsInRole("Administrador") ? null : Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),token)));
        group.MapPost("/teams", async (TeamInput input, SenxRepository repository, CancellationToken token) =>
        {
            if (!Valid(input.Name, 255) || !Valid(input.Department, 255)) return Results.Problem("Nome e departamento são obrigatórios e devem ter até 255 caracteres.", statusCode:400);
            var id = await repository.SaveTeam(null,input,token);
            return Results.Created($"/api/data/teams/{id}", new { id });
        }).RequireAuthorization("Admin");
        group.MapPut("/teams/{id:guid}", async (Guid id, TeamInput input, SenxRepository repository, CancellationToken token) =>
        {
            if (!Valid(input.Name,255) || !Valid(input.Department,255)) return Results.Problem("Nome e departamento são obrigatórios e devem ter até 255 caracteres.", statusCode:400);
            return await repository.SaveTeam(id,input,token) is null ? Results.NotFound() : Results.Ok(new { id });
        }).RequireAuthorization("Admin");
        group.MapPost("/criteria", async (CriterionInput input, SenxRepository repository, CancellationToken token) =>
        {
            if (!ValidCriterion(input)) return Results.Problem("Preencha nome, descrição, regra e versão, com até 255 caracteres cada.", statusCode:400);
            var id = await repository.SaveCriterion(null,input,token);
            return Results.Created($"/api/data/criteria/{id}",new { id });
        }).RequireAuthorization("Admin");
        group.MapPut("/criteria/{id:guid}", async (Guid id, CriterionInput input, SenxRepository repository, CancellationToken token) =>
        {
            if (!ValidCriterion(input)) return Results.Problem("Preencha nome, descrição, regra e versão, com até 255 caracteres cada.", statusCode:400);
            return await repository.SaveCriterion(id,input,token) is null ? Results.NotFound() : Results.Ok(new { id });
        }).RequireAuthorization("Admin");
        group.MapPost("/users", async (UserInput input, AuthRepository auth, CancellationToken token) =>
        {
            if (!AuthRepository.ValidUser(input)) return Results.Problem("Informe nome, e-mail, equipe, cargo, perfil e senha de 12 a 128 caracteres.",statusCode:400);
            var id = await auth.Create(input,token);
            return Results.Created($"/api/data/users/{id}",new { id });
        }).RequireAuthorization("Admin");

    }
    private static bool Valid(string? value,int length) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= length;
    private static bool ValidCriterion(CriterionInput value) => Valid(value.Name,255) && Valid(value.Description,255) && Valid(value.Rule,255) && Valid(value.Version,255);
}

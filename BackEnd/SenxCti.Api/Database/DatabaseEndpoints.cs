using System.Security.Claims;
using SenxCti.Api.Auth;

namespace SenxCti.Api.Database;

public static class DatabaseEndpoints
{
    public static void MapDatabaseEndpoints(this WebApplication app)
    {
        // Mesma origem da interface, disponível também no ambiente publicado.
        var group = app.MapGroup("/api/data").RequireAuthorization();
        group.MapDelete("/users/{id:guid}", async (Guid id,HttpContext context,CadastroDeletion deletion,CancellationToken token) =>
            (await deletion.Delete(true,id,Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),token)).ToHttp()).RequireAuthorization("Admin");
        group.MapDelete("/customers/{id:guid}", async (Guid id,HttpContext context,CadastroDeletion deletion,CancellationToken token) =>
            (await deletion.Delete(false,id,Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),token)).ToHttp()).RequireAuthorization("Admin");
        group.MapDelete("/calls/{id:guid}", async (Guid id,CadastroDeletion deletion,CancellationToken token) =>
            (await deletion.DeleteRecord("calls",id,token)).ToHttp()).RequireAuthorization("Admin");
        group.MapDelete("/criteria/{id:guid}", async (Guid id,CadastroDeletion deletion,CancellationToken token) =>
            (await deletion.DeleteRecord("criteria",id,token)).ToHttp()).RequireAuthorization("Admin");
        group.MapDelete("/teams/{id:guid}", async (Guid id,CadastroDeletion deletion,CancellationToken token) =>
            (await deletion.DeleteRecord("teams",id,token)).ToHttp()).RequireAuthorization("Admin");
        group.MapPut("/users/{id:guid}/active", async (Guid id, ActiveInput input, HttpContext context, DeliveryRepository delivery, CancellationToken token) =>
        {
            var status = await delivery.SetActive(id, Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),input.Active,token);
            return status == 200 ? Results.Ok(new { id, input.Active }) : Results.Problem(status == 409 ? "Não é possível desativar sua própria conta." : "Usuário não encontrado.",statusCode:status);
        }).RequireAuthorization("Admin");
        group.MapPut("/calls/{id:guid}/review", async (Guid id, ReviewInput input, HttpContext context, DeliveryRepository delivery, CancellationToken token) =>
        {
            if (!DeliveryRepository.ValidReview(input)) return Results.Problem("Informe análise, resumo (até 20 mil caracteres) e nota entre 0 e 100 ou sem nota.",statusCode:400);
            var status = await delivery.Review(id,Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),input,token);
            return status == 200 ? Results.Ok(new { id }) : Results.Problem(status == 409 ? "A análise foi atualizada por outra sessão. Atualize os dados antes de revisar." : "Ligação não encontrada.",statusCode:status);
        }).RequireAuthorization("Admin");
        group.MapDelete("/reports/{id:guid}", async (Guid id, DeliveryRepository delivery, CancellationToken token) =>
        {
            var status = await delivery.DeleteReport(id,token);
            return status == 204 ? Results.NoContent() : Results.Problem(
                status == 400 ? "Identificador de relatório inválido." : "Relatório não encontrado. Atualize a lista.",statusCode:status);
        }).RequireAuthorization("Admin");
        group.MapPost("/reports", async (ReportInput input, HttpContext context, DeliveryRepository delivery, CancellationToken token) =>
        {
            if (!DeliveryRepository.ValidReport(input)) return Results.Problem("Confira título, categoria, período, equipe e observações.",statusCode:400);
            try {
                var id = await delivery.CreateReport(Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),input,token);
                return Results.Created($"/api/data/reports/{id}",new { id });
            } catch (KeyNotFoundException) { return Results.Problem("Equipe não encontrada.",statusCode:400); }
        }).RequireAuthorization("Admin");
        group.MapGet("/rankings", async (Guid? teamId, string? period, DeliveryRepository delivery, CancellationToken token) =>
        {
            period ??= DeliveryRepository.Periods[0];
            if (teamId == Guid.Empty || !DeliveryRepository.Periods.Contains(period))
                return Results.Problem("Selecione um período e uma equipe válidos.", statusCode: 400);
            return Results.Ok(await delivery.Ranking(teamId, null, period, token));
        });
        group.MapGet("/calls/{id:guid}/audio", async (Guid id, HttpContext context, DeliveryRepository delivery, IConfiguration config, CancellationToken token) =>
        {
            var stored = await delivery.AudioPath(id,context.User.IsInRole("Administrador") ? null : Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),token);
            var path = DeliveryRepository.ResolveAudio(config["SENX_AUDIO_ROOT"],stored);
            if (path is null) return Results.Problem("Gravação não disponível para esta ligação.",statusCode:404);
            var mime = Path.GetExtension(path).ToLowerInvariant() switch { ".mp3" => "audio/mpeg", ".wav" => "audio/wav", ".ogg" => "audio/ogg", ".m4a" => "audio/mp4", ".mp4" => "video/mp4", ".webm" => "audio/webm", _ => null };
            return mime is null ? Results.Problem("Formato de áudio não suportado.",statusCode:415) : Results.File(path,mime,enableRangeProcessing:true);
        });
        group.MapGet("/snapshot", async (int? limit, HttpContext context, SenxRepository repository, CancellationToken token) => Results.Ok(await repository.Snapshot(context.User.IsInRole("Administrador") ? null : Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),token,limit ?? 200)));
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
        group.MapPost("/customers", async (CustomerInput input, HttpContext context, SenxRepository repository, CancellationToken token) =>
        {
            if (!ValidCustomer(input)) return Results.Problem("Preencha nome, e-mail e telefone (somente números, até 11 dígitos).", statusCode:400);
            var actorId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var id = await repository.SaveCustomer(null, actorId, input, token);
            return Results.Created($"/api/data/customers/{id}", new { id });
        }).RequireAuthorization("Admin");
        group.MapPut("/customers/{id:guid}", async (Guid id, CustomerInput input, HttpContext context, SenxRepository repository, CancellationToken token) =>
        {
            if (!ValidCustomer(input)) return Results.Problem("Preencha nome, e-mail e telefone (somente números, até 11 dígitos).", statusCode:400);
            var actorId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return await repository.SaveCustomer(id, actorId, input, token) is null ? Results.NotFound() : Results.Ok(new { id });
        }).RequireAuthorization("Admin");
        group.MapPost("/users", async (UserInput input, AuthRepository auth, CancellationToken token) =>
        {
            if (!AuthRepository.ValidUser(input)) return Results.Problem("Informe nome, e-mail, equipe, cargo, perfil e senha de 12 a 128 caracteres.",statusCode:400);
            var id = await auth.Create(input,token);
            return Results.Created($"/api/data/users/{id}",new { id });
        }).RequireAuthorization("Admin");
        group.MapPut("/users/{id:guid}", async (Guid id, UserUpdateInput input, HttpContext context, AuthRepository auth, CancellationToken token) =>
        {
            if (!AuthRepository.ValidUserUpdate(input))
                return Results.Problem("Informe nome, e-mail válido, equipe, cargo e perfil (Administrador ou Colaborador). A nova senha, se informada, deve ter de 12 a 128 caracteres.", statusCode: 400);
            var actorId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var status = await auth.Update(id, input, actorId, token);
            return status switch
            {
                200 => Results.Ok(new { id }),
                404 => Results.Problem("Usuário não encontrado.", statusCode: 404),
                409 => Results.Problem("Não é possível alterar seu próprio perfil de Administrador para Colaborador.", statusCode: 409),
                _ => Results.Problem("Equipe inválida ou dados incorretos.", statusCode: 400)
            };
        }).RequireAuthorization("Admin");

    }
    private static bool Valid(string? value,int length) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= length;
    private static bool ValidCriterion(CriterionInput value) => Valid(value.Name,255) && Valid(value.Description,255) && Valid(value.Rule,255) && Valid(value.Version,255);
    private static bool ValidCustomer(CustomerInput value) => Valid(value.Name,255) && Valid(value.Email,255) && !string.IsNullOrWhiteSpace(value.Phone) && value.Phone.Trim().Length is >= 1 and <= 11 && value.Phone.Trim().All(char.IsAsciiDigit) && (string.IsNullOrWhiteSpace(value.Status) || value.Status.Trim().Length <= 255);
}

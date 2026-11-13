using System.Security.Claims;
using Microsoft.AspNetCore.Http.Features;
using Npgsql;
using SenxCti.Api.Database;

namespace SenxCti.Api.Services.Audio;

public sealed record AudioCallInput(Guid IdFuncionario, Guid IdCliente, string NumeroOrigem, string NumeroDestino, string Direcao);
public sealed record AudioImportInput(string FileName, Guid IdFuncionario, Guid IdCliente, string NumeroOrigem, string NumeroDestino, string Direcao);

public static class AudioEndpoints
{
    public const long MaxBytes = 20 * 1024 * 1024;

    // Register before antiforgery: the standard API limit remains unchanged for other routes.
    public static void UseAudioUploadLimit(this WebApplication app) => app.Use(async (context, next) =>
    {
        if (context.Request.Path.Equals("/api/ligacoes/upload", StringComparison.OrdinalIgnoreCase))
        {
            var feature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (feature is { IsReadOnly: false }) feature.MaxRequestBodySize = MaxBytes + 65536;
        }
        await next(context);
    });

    public static void MapAudioEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/ligacoes").RequireAuthorization();
        group.MapGet("/upload-options", async (HttpContext context, DatabaseConnection database, CancellationToken ct) =>
        {
            var admin = context.User.IsInRole("Administrador");
            var actor = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await using var connection = await database.OpenAsync(ct);
            var users = new List<object>();
            var customers = new List<object>();
            await using (var cmd = new NpgsqlCommand("""SELECT "IdUsuario","Nome" FROM public."Usuario" WHERE "Ativo" AND (@admin OR "IdUsuario"=@actor) ORDER BY "Nome" LIMIT 1000""", connection))
            {
                cmd.Parameters.AddWithValue("admin", admin); cmd.Parameters.AddWithValue("actor", actor);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct)) users.Add(new { id = reader.GetGuid(0), name = reader.GetString(1) });
            }
            await using (var cmd = new NpgsqlCommand("""SELECT "IdDadosCliente","Nome","Telefone" FROM public."DadosCliente" ORDER BY "Nome" LIMIT 1000""", connection))
            {
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct)) customers.Add(new { id = reader.GetGuid(0), name = reader.GetString(1), phone = reader.GetString(2) });
            }
            return Results.Ok(new { users, customers, maxBytes = MaxBytes, canSelectAgent = admin });
        });
        group.MapPost("/upload", async (HttpContext context, AudioIngestion ingestion, CancellationToken ct) =>
        {
            if (!context.Request.HasFormContentType) return Results.Problem("Envie formulário multipart com áudio.", statusCode: 415);
            try
            {
                var form = await context.Request.ReadFormAsync(ct);
                var file = form.Files.GetFile("audio") ?? form.Files.GetFile("file");
                if (file is null || form.Files.Count != 1 || file.Length is <= 0 or > MaxBytes)
                    return Results.Problem("Escolha um áudio de até 20 MiB.", statusCode: 400);
                if (!Guid.TryParse(form["IdFuncionario"], out var user) || !Guid.TryParse(form["IdCliente"], out var customer))
                    return Results.Problem("Selecione atendente e cliente.", statusCode: 400);
                var input = new AudioCallInput(user, customer, form["NumeroOrigem"].ToString(), form["NumeroDestino"].ToString(), form["Direcao"].ToString());
                await using var stream = file.OpenReadStream();
                return await ingestion.Process(stream, file.FileName, input, context.User, ct);
            }
            catch (InvalidDataException) { return Results.Problem("Áudio ou formulário inválido.", statusCode: 400); }
            catch (BadHttpRequestException) { return Results.Problem("Formulário excede o limite permitido.", statusCode: 413); }
        }).RequireRateLimiting("audio");
        group.MapPost("/import", async (AudioImportInput input, HttpContext context, AudioIngestion ingestion, IConfiguration config, CancellationToken ct) =>
        {
            var file = DeliveryRepository.ResolveAudio(config["SENX_AUDIO_ROOT"], input.FileName);
            if (file is null) return Results.Problem("Arquivo não encontrado na pasta autorizada.", statusCode: 400);
            await using var stream = File.OpenRead(file);
            if (stream.Length is <= 0 or > MaxBytes) return Results.Problem("Áudio deve ter até 20 MiB.", statusCode: 400);
            return await ingestion.Process(stream, file, new(input.IdFuncionario, input.IdCliente, input.NumeroOrigem, input.NumeroDestino, input.Direcao), context.User, ct);
        }).RequireAuthorization("Admin").RequireRateLimiting("audio");
    }
}

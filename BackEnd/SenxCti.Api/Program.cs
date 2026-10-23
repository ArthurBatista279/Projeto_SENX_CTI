using Microsoft.Extensions.FileProviders;
using SenxCti.Api.Ai;
using SenxCti.Api.Contracts;
using SenxCti.Api.Database;

var builder = WebApplication.CreateBuilder(args);
if (builder.Environment.IsDevelopment()) builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);
builder.Configuration.AddEnvironmentVariables();
builder.Services.AddSingleton<IAiModelClient, FakeAiModelClient>();
builder.Services.AddSingleton<DatabaseHealthService>();
builder.Services.AddSingleton<SenxRepository>();

var app = builder.Build();
app.MapDatabaseTests();
// Ferramenta interna disponível somente no ambiente de desenvolvimento.
var managerPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "Documentacao", "Ferramentas", "Diagnostico"));
if (app.Environment.IsDevelopment() && Directory.Exists(managerPath))
{
    app.Use(async (context, next) =>
    {
        if (context.Request.Path.Value == "/gerenciador")
        {
            context.Response.Redirect("/gerenciador/");
            return;
        }
        await next(context);
    });
    app.MapGet("/gerenciador/{file?}", (string? file) =>
    {
        var name = file ?? "index.html";
        var contentType = name switch
        {
            "index.html" => "text/html; charset=utf-8",
            "app.js" => "text/javascript; charset=utf-8",
            "styles.css" => "text/css; charset=utf-8",
            _ => null
        };
        return contentType is null ? Results.NotFound() : Results.File(Path.Combine(managerPath, name), contentType);
    });
}
// Fonte principal da interface. FrontEnd contém somente a exportação portátil para revisão.
var frontendPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "Aplicacao", "SenxCti.Web", "wwwroot"));
if (Directory.Exists(frontendPath))
{
    var frontendFiles = new PhysicalFileProvider(frontendPath);
    app.UseStaticFiles(new StaticFileOptions { FileProvider = frontendFiles });
    app.MapGet("/", () => Results.File(Path.Combine(frontendPath, "index.html"), "text/html; charset=utf-8"));
}

app.MapGet("/api/health", (IConfiguration configuration, IAiModelClient ai) => Results.Ok(new
{
    status = "ok",
    service = "SENX CTI API",
    version = "0.1.2",
    databaseConfigured = !string.IsNullOrWhiteSpace(configuration["SENX_DB_CONNECTION"]),
    aiProvider = ai.Provider,
    utc = DateTimeOffset.UtcNow
}));

app.MapGet("/api/database/health", async (DatabaseHealthService database, CancellationToken cancellationToken) =>
{
    var result = await database.CheckAsync(cancellationToken);
    return result.Status == "ok" ? Results.Ok(result) : Results.Json(result, statusCode: StatusCodes.Status503ServiceUnavailable);
});

app.MapPost("/api/ai/analyze", async (AiAnalysisRequest request, IAiModelClient ai, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Transcript))
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["transcript"] = ["A transcrição é obrigatória."] });
    if (request.Transcript.Length > 100_000)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["transcript"] = ["A transcrição deve ter no máximo 100.000 caracteres neste ambiente de teste."] });

    return Results.Ok(await ai.AnalyzeAsync(request, cancellationToken));
});

app.MapFallback(() => Results.NotFound(new { error = "Rota não encontrada." }));
app.Run();

public partial class Program;

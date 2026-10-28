using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using Npgsql;
using SenxCti.Api.Auth;
using SenxCti.Api.Database;

var builder = WebApplication.CreateBuilder(args);
if (builder.Environment.IsDevelopment()) builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);
builder.Configuration.AddEnvironmentVariables();
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 32768);
builder.Services.AddSingleton<DatabaseConnection>();
builder.Services.AddSingleton<DatabaseHealthService>();
builder.Services.AddSingleton<SenxRepository>();
builder.Services.AddSingleton<AuthRepository>();
builder.Services.Configure<PasswordHasherOptions>(options => options.IterationCount = 210000);
builder.Services.AddSingleton<IPasswordHasher<UserAccount>,PasswordHasher<UserAccount>>();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-Token";
    options.Cookie.Name = "SENX.Csrf";
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "SENX.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = false;
    options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
    options.Events.OnValidatePrincipal = async context =>
    {
        var auth = context.HttpContext.RequestServices.GetRequiredService<AuthRepository>();
        if (!Guid.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier),out var id) ||
            await auth.Find(id,context.HttpContext.RequestAborted) is not { } user ||
            context.Principal?.FindFirstValue("credentialVersion") != user.CredentialVersion)
            context.RejectPrincipal();
        else context.ReplacePrincipal(AuthRepository.Principal(user));
    };
});
builder.Services.AddAuthorization(options => options.AddPolicy("Admin",policy => policy.RequireRole("Administrador")));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("login",context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

var app = builder.Build();
app.Use(async (context,next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        if (context.Request.Path != "/api/auth/csrf") context.Response.Headers.CacheControl = "no-store";
        var remote = context.Connection.RemoteIpAddress;
        if (remote is not null && !System.Net.IPAddress.IsLoopback(remote)) { context.Response.StatusCode = 403; return; }
    }
    try { await next(context); }
    catch (PostgresException error) when (error.SqlState is "23505" or "23503")
    { await Results.Problem("E-mail já cadastrado ou equipe inválida.",statusCode:409).ExecuteAsync(context); }
    catch (Exception error) when (error is NpgsqlException or TimeoutException or ArgumentException ||
        error is InvalidOperationException { Message: "database_not_configured" })
    {
        app.Logger.LogWarning("Operação PostgreSQL indisponível: {Code}",error is PostgresException pg ? pg.SqlState : error.GetType().Name);
        await Results.Problem("Não foi possível acessar o banco. Confira a configuração, a migração 0.1.4 e as permissões.",statusCode:503).ExecuteAsync(context);
    }
});
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context,next) =>
{
    if (context.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(context.Request.Method) &&
        !HttpMethods.IsHead(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method))
    {
        try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
        catch (AntiforgeryValidationException)
        { await Results.Problem("Sessão de formulário inválida. Atualize a página e tente novamente.",statusCode:403).ExecuteAsync(context); return; }
    }
    await next(context);
});
app.MapAuthEndpoints();
app.MapDatabaseEndpoints();

var frontendPath = Path.Combine(AppContext.BaseDirectory, "wwwroot");
if (Directory.Exists(frontendPath))
{
    var files = new PhysicalFileProvider(frontendPath);
    app.UseStaticFiles(new StaticFileOptions { FileProvider = files });
    app.MapGet("/", () => Results.File(Path.Combine(frontendPath, "index.html"), "text/html; charset=utf-8"));
}
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", service = "SENX CTI API", version = "0.1.4.3", utc = DateTimeOffset.UtcNow })).AllowAnonymous();
app.MapGet("/api/database/health", async (DatabaseHealthService database, CancellationToken token) =>
{
    var result = await database.CheckAsync(token);
    return Results.Json(result, statusCode: result.Status == "ok" ? 200 : 503);
}).RequireAuthorization("Admin");
app.MapFallback(() => Results.NotFound(new { error = "Rota não encontrada." }));
app.Run();

public partial class Program;

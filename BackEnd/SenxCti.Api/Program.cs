using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Repositories;
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
var developmentCrud = new DevelopmentCrudAccess(builder.Environment, builder.Configuration);
builder.Services.AddSingleton(developmentCrud);
if (args.Contains("--reset-password"))
{
    Environment.ExitCode = await LocalAccountRecovery.Run(builder.Configuration);
    return;
}
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 131072);
// Controllers, persistência e documentação.
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
builder.Services.AddDbContext<SenxContext>(options =>
    options.UseNpgsql(builder.Configuration["SENX_DB_CONNECTION"]));
builder.Services.AddScoped<IUsuarioRepository, UsuarioRepository>();
builder.Services.AddScoped<IEquipeRepository, EquipeRepository>();
builder.Services.AddScoped<IAlertaRepository, AlertaRepository>();
builder.Services.AddScoped<IAnaliseRepository, AnaliseRepository>();
builder.Services.AddScoped<IAssuntoRepository, AssuntoRepository>();
builder.Services.AddScoped<ICriterioRepository, CriterioRepository>();
builder.Services.AddScoped<IDadosClienteRepository, DadosClienteRepository>();
builder.Services.AddScoped<ILigacaoRepository, LigacaoRepository>();
builder.Services.AddScoped<IRegistroRepository, RegistroRepository>();
builder.Services.AddScoped<IResultadoRepository, ResultadoRepository>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SENX CTI API", Version = "v1",
        Description = developmentCrud.Enabled ? "Modo temporário de desenvolvimento: CRUD disponível sem login." :
            "Primeiro execute POST /api/Login com email e senha de uma conta de administrador. " +
            "O Swagger autoriza automaticamente as próximas chamadas após o login. " +
            "Ao atualizar a página, reiniciar a API ou expirar o token, faça login novamente."
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT",
        Description = "Obtenha o token em POST /api/Login e informe-o aqui."
    });
    if (!developmentCrud.Enabled) options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});
var jwt = new JwtSettings(builder.Configuration, builder.Environment);
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton<DatabaseConnection>();
builder.Services.AddSingleton<DatabaseHealthService>();
builder.Services.AddSingleton<SenxRepository>();
builder.Services.AddSingleton<DeliveryRepository>();
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
// O cookie continua sendo o esquema das rotas da interface; as controllers usam Bearer.
builder.Services.AddAuthentication().AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = jwt.Issuer,
        ValidateAudience = true, ValidAudience = jwt.Audience,
        ValidateIssuerSigningKey = true, IssuerSigningKey = jwt.Key,
        ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = ClaimTypes.Name, RoleClaimType = ClaimTypes.Role
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var auth = context.HttpContext.RequestServices.GetRequiredService<AuthRepository>();
            if (!Guid.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ||
                await auth.Find(id, context.HttpContext.RequestAborted) is not { } user ||
                context.Principal?.FindFirstValue("credentialVersion") != user.CredentialVersion)
                context.Fail("Credenciais inválidas.");
            else
                context.Principal = new ClaimsPrincipal(new ClaimsIdentity(
                    AuthRepository.Principal(user).Claims, JwtBearerDefaults.AuthenticationScheme));
        }
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", policy => policy.RequireRole("Administrador"));
    options.AddPolicy("Api", policy => policy.AddAuthenticationSchemes(
        JwtBearerDefaults.AuthenticationScheme).RequireAuthenticatedUser());
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("login",context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "SENX CTI API v1");
        options.UseResponseInterceptor("""
            function (response) {
                const path = new URL(response.url, window.location.origin).pathname;
                if (path.toLowerCase() === '/api/login') {
                    if (response.status === 200) {
                        const data = typeof response.data === 'string' ? JSON.parse(response.data) : (response.obj || response.data);
                        if (data && typeof data.token === 'string' && data.token.length > 0) {
                            window.ui.preauthorizeApiKey('Bearer', data.token);
                        }
                    } else {
                        window.ui.authActions.logout(['Bearer']);
                    }
                }
                return response;
            }
            """);
    });
}
app.Use(async (context,next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        if (context.Request.Path != "/api/auth/csrf") context.Response.Headers.CacheControl = "no-store";
        var remote = context.Connection.RemoteIpAddress;
        if (builder.Configuration.GetValue("SENX_LOCAL_ONLY", false) && remote is not null && !System.Net.IPAddress.IsLoopback(remote)) { context.Response.StatusCode = 403; return; }
    }
    try { await next(context); }
    catch (DbUpdateException error) when (error.InnerException is PostgresException { SqlState: "23505" or "23503" })
    { await Results.Problem("E-mail já cadastrado, equipe inválida ou usuário com registros vinculados.", statusCode: 409).ExecuteAsync(context); }
    catch (PostgresException error) when (error.SqlState is "23505" or "23503")
    { await Results.Problem("E-mail já cadastrado ou equipe inválida.",statusCode:409).ExecuteAsync(context); }
    catch (PostgresException error) when (error.SqlState is "42P01" or "42703")
    { await Results.Problem("Esquema do banco desatualizado. Aplique as migrações 0.1.4 e 0.1.5 após backup.",statusCode:503).ExecuteAsync(context); }
    catch (Exception error) when (error is NpgsqlException or TimeoutException or ArgumentException ||
        error is DbUpdateException { InnerException: NpgsqlException or TimeoutException } ||
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
    if (context.GetEndpoint()?.Metadata.GetMetadata<ControllerActionDescriptor>() is null &&
        context.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(context.Request.Method) &&
        !HttpMethods.IsHead(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method))
    {
        try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
        catch (AntiforgeryValidationException)
        { await Results.Problem("Sessão de formulário inválida. Atualize a página e tente novamente.",statusCode:403).ExecuteAsync(context); return; }
    }
    await next(context);
});
var controllers = app.MapControllers().RequireAuthorization("Api");
if (developmentCrud.Enabled)
{
    controllers.AllowAnonymous();
    app.Logger.LogWarning("CRUD sem login habilitado temporariamente em Development.");
}
app.MapAuthEndpoints();
app.MapDatabaseEndpoints();

var frontendPath = app.Environment.IsDevelopment()
    ? Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "Aplicacao", "SenxCti.Web", "wwwroot"))
    : Path.Combine(AppContext.BaseDirectory, "wwwroot");
if (app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        await next(context);
    });
    app.Logger.LogInformation("Interface SENX: {FrontendPath}", frontendPath);
}
var imagensPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "imagens");
Directory.CreateDirectory(imagensPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(imagensPath),
    RequestPath = "/imagens"
});
if (Directory.Exists(frontendPath))
{
    var files = new PhysicalFileProvider(frontendPath);
    app.UseStaticFiles(new StaticFileOptions { FileProvider = files });
    app.MapGet("/", () => Results.File(Path.Combine(frontendPath, "index.html"), "text/html; charset=utf-8"));
}
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", service = "SENX CTI API", version = "0.1.5.0", utc = DateTimeOffset.UtcNow })).AllowAnonymous();
app.MapGet("/api/database/health", async (DatabaseHealthService database, CancellationToken token) =>
{
    var result = await database.CheckAsync(token);
    return Results.Json(result, statusCode: result.Status == "ok" ? 200 : 503);
}).RequireAuthorization("Admin");
app.MapFallback(() => Results.NotFound(new { error = "Rota não encontrada." }));
app.Run();

public partial class Program;

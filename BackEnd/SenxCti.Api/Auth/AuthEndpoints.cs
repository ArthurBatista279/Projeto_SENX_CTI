using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace SenxCti.Api.Auth;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth");
        group.MapGet("/csrf", (HttpContext context, IAntiforgery csrf) =>
            Results.Ok(new { token = csrf.GetAndStoreTokens(context).RequestToken })).AllowAnonymous();
        group.MapGet("/status", async (AuthRepository auth, CancellationToken token) =>
            Results.Ok(await auth.SetupStatus(token))).AllowAnonymous();
        group.MapGet("/session", async (HttpContext context, AuthRepository auth, CancellationToken token) =>
            Results.Ok(await auth.Find(Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),token))).RequireAuthorization();
        group.MapPost("/login", async (LoginInput input, AuthRepository auth, HttpContext context, CancellationToken token) =>
        {
            if (!AuthRepository.ValidEmail(input.Email) || input.Password is not { Length: > 0 and <= 128 })
                return Results.Problem("Informe um e-mail e uma senha válidos.",statusCode:400);
            var user = await auth.Login(input,token);
            if (user is null) return Results.Problem("E-mail ou senha inválidos.",statusCode:401);
            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,AuthRepository.Principal(user),
                new AuthenticationProperties { IsPersistent = input.RememberMe,
                    ExpiresUtc = DateTimeOffset.UtcNow.Add(input.RememberMe ? TimeSpan.FromDays(14) : TimeSpan.FromHours(8)) });
            return Results.Ok(user);
        }).AllowAnonymous().RequireRateLimiting("login");
        group.MapPost("/setup", async (SetupInput input, AuthRepository auth, CancellationToken token) =>
        {
            if (!AuthRepository.ValidSetup(input)) return Results.Problem("Preencha nome, e-mail, equipe e senha de 12 a 128 caracteres.",statusCode:400);
            var id = await auth.Setup(input,token);
            return id is null ? Results.Problem("A configuração inicial já foi concluída.",statusCode:409) :
                Results.Created("/api/auth/session",new { id });
        }).AllowAnonymous().RequireRateLimiting("login");
        group.MapPost("/logout", async (HttpContext context) =>
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new { status = "ok" });
        }).RequireAuthorization();
        group.MapPut("/profile", async (ProfileInput input, AuthRepository auth, HttpContext context, CancellationToken token) =>
        {
            if (!AuthRepository.ValidProfile(input))
                return Results.Problem("Informe nome, e-mail e senha atual. A nova senha deve ter de 12 a 128 caracteres.",statusCode:400);
            var user = await auth.SaveProfile(Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!),input,token);
            if (user is null) return Results.Problem("Senha atual incorreta ou conta indisponível.",statusCode:400);
            var requiresLogin = !string.IsNullOrEmpty(input.NewPassword);
            if (requiresLogin) await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            else
            {
                var ticket = await context.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,AuthRepository.Principal(user),ticket.Properties);
            }
            return Results.Ok(new { requiresLogin, user = requiresLogin ? null : user });
        }).RequireAuthorization().RequireRateLimiting("login");
    }
}

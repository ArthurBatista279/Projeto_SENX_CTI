using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using SenxCti.Api.Auth;
using SenxCti.Api.DTO;

namespace SenxCti.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LoginController(AuthRepository auth, JwtSettings jwt) : ControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginDTO input, CancellationToken cancellationToken)
    {
        var user = await auth.Login(new(input.Email, input.Senha), cancellationToken);
        if (user is null) return Unauthorized(new { mensagem = "E-mail ou senha inválidos." });
        var expires = DateTime.UtcNow.AddMinutes(jwt.ExpirationMinutes);
        var claims = AuthRepository.Principal(user).Claims.Concat(new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        });
        var token = new JwtSecurityToken(jwt.Issuer, jwt.Audience, claims,
            expires: expires, signingCredentials: new(jwt.Key, SecurityAlgorithms.HmacSha256));
        return Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), expiresAt = expires });
    }
}

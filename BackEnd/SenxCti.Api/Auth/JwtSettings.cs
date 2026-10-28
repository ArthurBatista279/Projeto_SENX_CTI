using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace SenxCti.Api.Auth;

public sealed class JwtSettings
{
    public string Issuer { get; }
    public string Audience { get; }
    public int ExpirationMinutes { get; }
    public SymmetricSecurityKey Key { get; }

    public JwtSettings(IConfiguration configuration, IHostEnvironment environment)
    {
        Issuer = configuration["Jwt:Issuer"] ?? "SenxCti.Api";
        Audience = configuration["Jwt:Audience"] ?? "SenxCti.Client";
        ExpirationMinutes = configuration.GetValue("Jwt:ExpirationMinutes", 30);
        if (ExpirationMinutes <= 0) throw new InvalidOperationException("Jwt:ExpirationMinutes deve ser positivo.");
        var secret = configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(secret) && environment.IsDevelopment())
            Key = new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(32));
        else if (string.IsNullOrWhiteSpace(secret) || Encoding.UTF8.GetByteCount(secret) < 32)
            throw new InvalidOperationException("Configure Jwt:Key com pelo menos 32 bytes (variável Jwt__Key).");
        else Key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
    }
}

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace SenxCti.Api.Auth;

// Preserva contas Identity existentes e aceita o seed BCrypt do banco consolidado.
public sealed class CompatiblePasswordHasher(IOptions<PasswordHasherOptions> options) : PasswordHasher<UserAccount>(options)
{
    public override PasswordVerificationResult VerifyHashedPassword(UserAccount user, string hashedPassword, string providedPassword)
    {
        if (!hashedPassword.StartsWith("$2")) return base.VerifyHashedPassword(user, hashedPassword, providedPassword);
        try
        {
            return System.Text.Encoding.UTF8.GetByteCount(providedPassword) <= 72 && BCrypt.Net.BCrypt.Verify(providedPassword, hashedPassword)
                ? PasswordVerificationResult.Success : PasswordVerificationResult.Failed;
        }
        catch (Exception error) when (error is ArgumentException or BCrypt.Net.SaltParseException)
        { return PasswordVerificationResult.Failed; }
    }
}

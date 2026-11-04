namespace SenxCti.Api.Auth;

public sealed class DevelopmentCrudAccess(IHostEnvironment environment, IConfiguration configuration)
{
    public bool Enabled { get; } = environment.IsDevelopment() &&
        configuration.GetValue<bool>("Development:AllowAnonymousCrud");
}

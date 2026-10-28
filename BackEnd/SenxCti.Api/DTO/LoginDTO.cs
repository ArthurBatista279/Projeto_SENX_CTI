using System.ComponentModel.DataAnnotations;

namespace SenxCti.Api.DTO;

public class LoginDTO
{
    [Required, EmailAddress, MaxLength(255)]
    public string Email { get; set; } = string.Empty;
    [Required, MaxLength(128)]
    public string Senha { get; set; } = string.Empty;
}

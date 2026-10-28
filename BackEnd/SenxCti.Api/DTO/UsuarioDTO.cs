using System.ComponentModel.DataAnnotations;
using SenxCti.Api.Models;

namespace SenxCti.Api.DTO;

public class UsuarioDTO : IValidatableObject
{
    public Guid IdEquipe { get; set; }
    [Required, MaxLength(200)] public string Nome { get; set; } = string.Empty;
    [Required, EmailAddress, MaxLength(255)] public string Email { get; set; } = string.Empty;
    public IFormFile? Imagem { get; set; }
    [Required, MaxLength(255)] public string Cargo { get; set; } = string.Empty;
    [Required, StringLength(128, MinimumLength = 12)] public string Senha { get; set; } = string.Empty;
    [Required, RegularExpression("^(Administrador|Colaborador)$")]
    public string Perfil { get; set; } = "Colaborador";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Imagem is { Length: > 0 })
        {
            if (Imagem.Length > 5 * 1024 * 1024)
                yield return new ValidationResult("A imagem deve ter no máximo 5 MB.", [nameof(Imagem)]);

            var extensao = Path.GetExtension(Imagem.FileName).ToLowerInvariant();
            if (extensao is not (".jpg" or ".jpeg" or ".png" or ".gif" or ".webp"))
                yield return new ValidationResult("Envie uma imagem JPG, PNG, GIF ou WebP.", [nameof(Imagem)]);
        }
        if (IdEquipe == Guid.Empty)
            yield return new ValidationResult("Informe uma equipe válida.", [nameof(IdEquipe)]);
    }

    public Usuario ToModel(Guid id = default) => new()
    {
        IdUsuario = id, IdEquipe = IdEquipe, Nome = Nome.Trim(),
        Email = Email.Trim().ToLowerInvariant(), Imagem = string.Empty,
        Cargo = Cargo.Trim(), Senha = Senha, Perfil = Perfil
    };
}

public sealed record UsuarioRespostaDTO(Guid IdUsuario, Guid IdEquipe, string Nome,
    string Email, string Imagem, string Cargo, string Perfil)
{
    public static UsuarioRespostaDTO FromModel(Usuario user) => new(user.IdUsuario,
        user.IdEquipe, user.Nome, user.Email, user.Imagem, user.Cargo, user.Perfil);
}

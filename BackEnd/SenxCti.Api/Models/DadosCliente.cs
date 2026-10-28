using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class DadosCliente
{
    public Guid IdDadosCliente { get; set; }

    public Guid IdUsuario { get; set; }

    public string Nome { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Telefone { get; set; } = null!;

    public string Situacao { get; set; } = null!;

    public bool Consentimento { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Usuario IdUsuarioNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Ligacao> Ligacao { get; set; } = new List<Ligacao>();
}

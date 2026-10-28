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

    public virtual Usuario IdUsuarioNavigation { get; set; } = null!;

    public virtual ICollection<Ligacao> Ligacaos { get; set; } = new List<Ligacao>();
}

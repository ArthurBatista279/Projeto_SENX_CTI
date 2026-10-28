using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Usuario
{
    public Guid IdUsuario { get; set; }

    public Guid IdEquipe { get; set; }

    public string Nome { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Imagem { get; set; } = null!;

    public string Cargo { get; set; } = null!;

    public string Senha { get; set; } = null!;

    public virtual ICollection<Alerta> Alerta { get; set; } = new List<Alerta>();

    public virtual ICollection<DadosCliente> DadosClientes { get; set; } = new List<DadosCliente>();

    public virtual Equipe IdEquipeNavigation { get; set; } = null!;

    public virtual ICollection<Ligacao> Ligacaos { get; set; } = new List<Ligacao>();

    public virtual ICollection<Registro> Registros { get; set; } = new List<Registro>();

    public virtual ICollection<Resultado> Resultados { get; set; } = new List<Resultado>();
}

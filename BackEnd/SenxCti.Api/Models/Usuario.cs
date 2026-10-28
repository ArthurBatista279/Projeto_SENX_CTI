using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Usuario
{
    public Guid IdUsuario { get; set; }

    public string Perfil { get; set; } = "Colaborador";

    public Guid IdEquipe { get; set; }

    public string Nome { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Imagem { get; set; } = null!;

    public string Cargo { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public string Senha { get; set; } = null!;

    public virtual ICollection<Alerta> Alerta { get; set; } = new List<Alerta>();

    public virtual ICollection<DadosCliente> DadosCliente { get; set; } = new List<DadosCliente>();

    public virtual Equipe IdEquipeNavigation { get; set; } = null!;

    public virtual ICollection<Ligacao> Ligacao { get; set; } = new List<Ligacao>();

    public virtual ICollection<Registro> Registro { get; set; } = new List<Registro>();

    public virtual ICollection<Resultado> Resultado { get; set; } = new List<Resultado>();
}

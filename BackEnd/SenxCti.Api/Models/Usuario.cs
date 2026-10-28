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

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Alerta> Alerta { get; set; } = new List<Alerta>();

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<DadosCliente> DadosCliente { get; set; } = new List<DadosCliente>();

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Equipe IdEquipeNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Ligacao> Ligacao { get; set; } = new List<Ligacao>();

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Registro> Registro { get; set; } = new List<Registro>();

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Resultado> Resultado { get; set; } = new List<Resultado>();
}

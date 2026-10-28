using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Ligacao
{
    public Guid IdLigacao { get; set; }

    public Guid IdFuncionario { get; set; }

    public Guid IdCliente { get; set; }

    public DateTime DataInicio { get; set; }

    public TimeOnly Duracao { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(11)]
    public string NumeroOrigem { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(11)]
    public string NumeroDestino { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Stats { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string HashAudio { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string CaminhoArquivo { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string IdentificadorPabx { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Direcao { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Analise> Analise { get; set; } = new List<Analise>();

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual DadosCliente IdClienteNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Assunto> IdAssunto { get; set; } = new List<Assunto>();
}

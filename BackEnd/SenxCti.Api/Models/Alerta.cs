using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Alerta
{
    public Guid IdAlerta { get; set; }

    public Guid IdAnalise { get; set; }

    public Guid IdEquipe { get; set; }

    public Guid IdFuncionario { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Tipo { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Severidade { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Mensagem { get; set; } = null!;

    public bool StatusTratamento { get; set; }

    public bool StatusValidacao { get; set; }

    public DateTime ValidadoEm { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Observacao { get; set; } = null!;

    public DateTime CriadoEm { get; set; }

    public DateTime ResolvidoEm { get; set; }

    public string Justificativa { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string TrechoEvidencia { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Analise IdAnaliseNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Equipe IdEquipeNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;
}

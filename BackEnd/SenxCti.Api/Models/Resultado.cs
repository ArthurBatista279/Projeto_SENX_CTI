using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Resultado
{
    public Guid IdResultado { get; set; }

    public Guid IdCriterio { get; set; }

    public Guid IdAnalise { get; set; }

    public Guid IdFuncionario { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Classificacao { get; set; } = null!;

    public int Score { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Justificativa { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string TrechoEvidencia { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string ResultadoValidado { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string StatusValidacao { get; set; } = null!;

    public DateTime ValidadoEm { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string ObservacaoValidacao { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Analise IdAnaliseNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Criterio IdCriterioNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;
}

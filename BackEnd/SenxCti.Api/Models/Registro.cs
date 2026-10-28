using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Registro
{
    public Guid IdRegistro { get; set; }

    public Guid IdAnalise { get; set; }

    public Guid IdFuncionario { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Descricao { get; set; } = null!;

    public DateTime Prazo { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Status { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Analise IdAnaliseNavigation { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;
}

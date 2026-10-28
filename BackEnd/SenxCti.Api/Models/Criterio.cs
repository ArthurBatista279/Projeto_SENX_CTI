using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Criterio
{
    public Guid IdCriterio { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Nome { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Descricao { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string RegraAvaliacao { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Versao { get; set; } = null!;

    public bool Ativo { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Resultado> Resultado { get; set; } = new List<Resultado>();
}

using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Equipe
{
    public Guid IdEquipe { get; set; }

    public string Nome { get; set; } = null!;

    public string Departamento { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Alerta> Alerta { get; set; } = new List<Alerta>();

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Usuario> Usuario { get; set; } = new List<Usuario>();
}

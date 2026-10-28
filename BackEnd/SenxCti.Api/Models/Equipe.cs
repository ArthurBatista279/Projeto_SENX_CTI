using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Equipe
{
    public Guid IdEquipe { get; set; }

    public string Nome { get; set; } = null!;

    public string Departamento { get; set; } = null!;

    public virtual ICollection<Alerta> Alerta { get; set; } = new List<Alerta>();

    public virtual ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();
}

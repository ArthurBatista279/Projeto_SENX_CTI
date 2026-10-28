using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Criterio
{
    public Guid IdCriterio { get; set; }

    public string Nome { get; set; } = null!;

    public string Descricao { get; set; } = null!;

    public string RegraAvaliacao { get; set; } = null!;

    public string Versao { get; set; } = null!;

    public bool Ativo { get; set; }

    public virtual ICollection<Resultado> Resultado { get; set; } = new List<Resultado>();
}

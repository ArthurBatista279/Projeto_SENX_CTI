using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("Criterio")]
public partial class Criterio
{
    [Key]
    public Guid IdCriterio { get; set; }

    [StringLength(255)]
    public string Nome { get; set; } = null!;

    [StringLength(255)]
    public string Descricao { get; set; } = null!;

    [StringLength(255)]
    public string RegraAvaliacao { get; set; } = null!;

    [StringLength(255)]
    public string Versao { get; set; } = null!;

    public bool Ativo { get; set; }

    [InverseProperty("IdCriterioNavigation")]
    public virtual ICollection<Resultado> Resultados { get; set; } = new List<Resultado>();
}

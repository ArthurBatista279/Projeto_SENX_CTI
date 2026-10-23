using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("Registro")]
public partial class Registro
{
    [Key]
    public Guid IdRegistro { get; set; }

    public Guid IdAnalise { get; set; }

    public Guid IdFuncionario { get; set; }

    [StringLength(255)]
    public string Descricao { get; set; } = null!;

    [Column(TypeName = "datetime")]
    public DateTime Prazo { get; set; }

    [StringLength(255)]
    public string Status { get; set; } = null!;

    [ForeignKey("IdAnalise")]
    [InverseProperty("Registros")]
    public virtual Analise IdAnaliseNavigation { get; set; } = null!;

    [ForeignKey("IdFuncionario")]
    [InverseProperty("Registros")]
    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;
}

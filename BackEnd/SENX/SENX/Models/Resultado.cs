using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("Resultado")]
public partial class Resultado
{
    [Key]
    public Guid IdResultado { get; set; }

    public Guid IdCriterio { get; set; }

    public Guid IdAnalise { get; set; }

    public Guid IdFuncionario { get; set; }

    [StringLength(255)]
    public string Classificacao { get; set; } = null!;

    public int Score { get; set; }

    [StringLength(255)]
    public string Justificativa { get; set; } = null!;

    [StringLength(255)]
    public string TrechoEvidencia { get; set; } = null!;

    [StringLength(255)]
    public string ResultadoValidado { get; set; } = null!;

    [StringLength(255)]
    public string StatusValidacao { get; set; } = null!;

    [Column("Validado_em", TypeName = "datetime")]
    public DateTime ValidadoEm { get; set; }

    [StringLength(255)]
    public string ObservacaoValidacao { get; set; } = null!;

    [ForeignKey("IdAnalise")]
    [InverseProperty("Resultados")]
    public virtual Analise IdAnaliseNavigation { get; set; } = null!;

    [ForeignKey("IdCriterio")]
    [InverseProperty("Resultados")]
    public virtual Criterio IdCriterioNavigation { get; set; } = null!;

    [ForeignKey("IdFuncionario")]
    [InverseProperty("Resultados")]
    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;
}

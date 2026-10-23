using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

public partial class Alertum
{
    [Key]
    public Guid IdAlerta { get; set; }

    public Guid IdAnalise { get; set; }

    public Guid IdEquipe { get; set; }

    public Guid IdFuncionario { get; set; }

    [StringLength(255)]
    public string Tipo { get; set; } = null!;

    [StringLength(255)]
    public string Severidade { get; set; } = null!;

    [StringLength(255)]
    public string Mensagem { get; set; } = null!;

    public bool StatusTratamento { get; set; }

    [Column("Status_Validacao")]
    public bool StatusValidacao { get; set; }

    [Column("Validado_em", TypeName = "datetime")]
    public DateTime ValidadoEm { get; set; }

    [StringLength(255)]
    public string Observacao { get; set; } = null!;

    [Column("Criado_em", TypeName = "datetime")]
    public DateTime CriadoEm { get; set; }

    [Column("Resolvido_em", TypeName = "datetime")]
    public DateTime ResolvidoEm { get; set; }

    public string Justificativa { get; set; } = null!;

    [StringLength(255)]
    public string TrechoEvidencia { get; set; } = null!;

    [ForeignKey("IdAnalise")]
    [InverseProperty("Alerta")]
    public virtual Analise IdAnaliseNavigation { get; set; } = null!;

    [ForeignKey("IdEquipe")]
    [InverseProperty("Alerta")]
    public virtual Equipe IdEquipeNavigation { get; set; } = null!;

    [ForeignKey("IdFuncionario")]
    [InverseProperty("Alerta")]
    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;
}

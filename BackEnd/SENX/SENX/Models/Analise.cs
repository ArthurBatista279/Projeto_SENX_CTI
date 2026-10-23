using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("Analise")]
public partial class Analise
{
    [Key]
    public Guid IdAnalise { get; set; }

    public Guid IdLigacao { get; set; }

    [Column("Data_Analise", TypeName = "datetime")]
    public DateTime DataAnalise { get; set; }

    [StringLength(255)]
    public string ResolucaoEncaminhamento { get; set; } = null!;

    public bool? StatusProcessamento { get; set; }

    [Column("Modelo_Versao")]
    [StringLength(200)]
    public string ModeloVersao { get; set; } = null!;

    [Column("Transcricao_Texto")]
    public string TranscricaoTexto { get; set; } = null!;

    [Column("Resumo_Texto")]
    public string ResumoTexto { get; set; } = null!;

    public bool Cancelamento { get; set; }

    public bool Oportunidade { get; set; }

    public int ScoreGeral { get; set; }

    [StringLength(255)]
    public string ProblemaNecessidade { get; set; } = null!;

    [StringLength(255)]
    public string Compromissos { get; set; } = null!;

    [InverseProperty("IdAnaliseNavigation")]
    public virtual ICollection<Alertum> Alerta { get; set; } = new List<Alertum>();

    [ForeignKey("IdLigacao")]
    [InverseProperty("Analises")]
    public virtual Ligacao IdLigacaoNavigation { get; set; } = null!;

    [InverseProperty("IdAnaliseNavigation")]
    public virtual ICollection<Registro> Registros { get; set; } = new List<Registro>();

    [InverseProperty("IdAnaliseNavigation")]
    public virtual ICollection<Resultado> Resultados { get; set; } = new List<Resultado>();
}

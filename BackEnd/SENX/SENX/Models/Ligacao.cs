using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("Ligacao")]
public partial class Ligacao
{
    [Key]
    public Guid IdLigacao { get; set; }

    public Guid IdFuncionario { get; set; }

    public Guid IdCliente { get; set; }

    [Column("Data_Inicio", TypeName = "datetime")]
    public DateTime DataInicio { get; set; }

    public TimeOnly Duracao { get; set; }

    [Column("Numero_Origem")]
    [StringLength(11)]
    public string NumeroOrigem { get; set; } = null!;

    [Column("Numero_Destino")]
    [StringLength(11)]
    public string NumeroDestino { get; set; } = null!;

    [StringLength(255)]
    public string Stats { get; set; } = null!;

    [Column("Hash_Audio")]
    [StringLength(255)]
    public string HashAudio { get; set; } = null!;

    [Column("Caminho_Arquivo")]
    [StringLength(255)]
    public string CaminhoArquivo { get; set; } = null!;

    [Column("IdentificadorPABX")]
    [StringLength(255)]
    public string IdentificadorPabx { get; set; } = null!;

    [StringLength(255)]
    public string Direcao { get; set; } = null!;

    [InverseProperty("IdLigacaoNavigation")]
    public virtual ICollection<Analise> Analises { get; set; } = new List<Analise>();

    [ForeignKey("IdCliente")]
    [InverseProperty("Ligacaos")]
    public virtual DadosCliente IdClienteNavigation { get; set; } = null!;

    [ForeignKey("IdFuncionario")]
    [InverseProperty("Ligacaos")]
    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;

    [ForeignKey("IdLigacao")]
    [InverseProperty("IdLigacaos")]
    public virtual ICollection<Assunto> IdAssuntos { get; set; } = new List<Assunto>();
}

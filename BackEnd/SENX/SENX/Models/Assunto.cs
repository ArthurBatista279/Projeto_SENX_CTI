using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("Assunto")]
public partial class Assunto
{
    [Key]
    public Guid IdAssunto { get; set; }

    [StringLength(255)]
    public string Nome { get; set; } = null!;

    [StringLength(255)]
    public string Descricao { get; set; } = null!;

    [StringLength(255)]
    public string Categoria { get; set; } = null!;

    [ForeignKey("IdAssunto")]
    [InverseProperty("IdAssuntos")]
    public virtual ICollection<Ligacao> IdLigacaos { get; set; } = new List<Ligacao>();
}

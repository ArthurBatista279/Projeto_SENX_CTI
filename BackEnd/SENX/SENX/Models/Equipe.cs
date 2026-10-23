using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("Equipe")]
public partial class Equipe
{
    [Key]
    public Guid IdEquipe { get; set; }

    [StringLength(255)]
    public string Nome { get; set; } = null!;

    [StringLength(255)]
    public string Departameo { get; set; } = null!;

    [InverseProperty("IdEquipeNavigation")]
    public virtual ICollection<Alertum> Alerta { get; set; } = new List<Alertum>();

    [InverseProperty("IdEquipeNavigation")]
    public virtual ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();
}

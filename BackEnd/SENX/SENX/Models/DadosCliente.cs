using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("DadosCliente")]
[Index("Telefone", Name = "UQ__DadosCli__4EC504B6343B7CCF", IsUnique = true)]
[Index("Email", Name = "UQ__DadosCli__A9D105345C0FD71C", IsUnique = true)]
public partial class DadosCliente
{
    [Key]
    public Guid IdDadosCliente { get; set; }

    public Guid IdUsuario { get; set; }

    [StringLength(255)]
    public string Nome { get; set; } = null!;

    [StringLength(255)]
    public string Email { get; set; } = null!;

    [StringLength(11)]
    public string Telefone { get; set; } = null!;

    [StringLength(255)]
    public string Situacao { get; set; } = null!;

    public bool Consentimento { get; set; }

    [ForeignKey("IdUsuario")]
    [InverseProperty("DadosClientes")]
    public virtual Usuario IdUsuarioNavigation { get; set; } = null!;

    [InverseProperty("IdClienteNavigation")]
    public virtual ICollection<Ligacao> Ligacaos { get; set; } = new List<Ligacao>();
}

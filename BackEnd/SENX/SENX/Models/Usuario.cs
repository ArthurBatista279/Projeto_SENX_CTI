using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SENX.Models;

[Table("Usuario")]
[Index("Email", Name = "UQ__Usuario__A9D10534FBBB6BCE", IsUnique = true)]
public partial class Usuario
{
    [Key]
    public Guid IdUsuario { get; set; }

    public Guid IdEquipe { get; set; }

    [StringLength(200)]
    public string Nome { get; set; } = null!;

    [StringLength(255)]
    public string Email { get; set; } = null!;

    [StringLength(255)]
    public string Imagem { get; set; } = null!;

    [StringLength(255)]
    public string Cargo { get; set; } = null!;

    [StringLength(40)]
    public string Senha { get; set; } = null!;

    [InverseProperty("IdFuncionarioNavigation")]
    public virtual ICollection<Alertum> Alerta { get; set; } = new List<Alertum>();

    [InverseProperty("IdUsuarioNavigation")]
    public virtual ICollection<DadosCliente> DadosClientes { get; set; } = new List<DadosCliente>();

    [ForeignKey("IdEquipe")]
    [InverseProperty("Usuarios")]
    public virtual Equipe IdEquipeNavigation { get; set; } = null!;

    [InverseProperty("IdFuncionarioNavigation")]
    public virtual ICollection<Ligacao> Ligacaos { get; set; } = new List<Ligacao>();

    [InverseProperty("IdFuncionarioNavigation")]
    public virtual ICollection<Registro> Registros { get; set; } = new List<Registro>();

    [InverseProperty("IdFuncionarioNavigation")]
    public virtual ICollection<Resultado> Resultados { get; set; } = new List<Resultado>();
}

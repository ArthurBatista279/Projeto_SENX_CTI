using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using SENX.Models;

namespace SENX.BdContextSenx;

public partial class SenxsContext : DbContext
{
    public SenxsContext()
    {
    }

    public SenxsContext(DbContextOptions<SenxsContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Alertum> Alerta { get; set; }

    public virtual DbSet<Analise> Analises { get; set; }

    public virtual DbSet<Assunto> Assuntos { get; set; }

    public virtual DbSet<Criterio> Criterios { get; set; }

    public virtual DbSet<DadosCliente> DadosClientes { get; set; }

    public virtual DbSet<Equipe> Equipes { get; set; }

    public virtual DbSet<Ligacao> Ligacaos { get; set; }

    public virtual DbSet<Registro> Registros { get; set; }

    public virtual DbSet<Resultado> Resultados { get; set; }

    public virtual DbSet<Usuario> Usuarios { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
        => optionsBuilder.UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=CTI_Chamadas;Trusted_Connection=True;TrustServerCertificate=True;");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Alertum>(entity =>
        {
            entity.HasKey(e => e.IdAlerta).HasName("PK__Alerta__D2CDBC4F48BBDE7E");

            entity.Property(e => e.IdAlerta).HasDefaultValueSql("(newid())");
            entity.Property(e => e.CriadoEm).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.ResolvidoEm).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.ValidadoEm).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.IdAnaliseNavigation).WithMany(p => p.Alerta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Alerta__IdAnalis__7F2BE32F");

            entity.HasOne(d => d.IdEquipeNavigation).WithMany(p => p.Alerta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Alerta__IdEquipe__00200768");

            entity.HasOne(d => d.IdFuncionarioNavigation).WithMany(p => p.Alerta)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Alerta__IdFuncio__01142BA1");
        });

        modelBuilder.Entity<Analise>(entity =>
        {
            entity.HasKey(e => e.IdAnalise).HasName("PK__Analise__553FB46FF1A87849");

            entity.Property(e => e.IdAnalise).HasDefaultValueSql("(newid())");
            entity.Property(e => e.DataAnalise).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.IdLigacaoNavigation).WithMany(p => p.Analises)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Analise__IdLigac__787EE5A0");
        });

        modelBuilder.Entity<Assunto>(entity =>
        {
            entity.HasKey(e => e.IdAssunto).HasName("PK__Assunto__979CBB48BF9ED48A");

            entity.Property(e => e.IdAssunto).HasDefaultValueSql("(newid())");
        });

        modelBuilder.Entity<Criterio>(entity =>
        {
            entity.HasKey(e => e.IdCriterio).HasName("PK__Criterio__71394482D8B14BA5");

            entity.Property(e => e.IdCriterio).HasDefaultValueSql("(newid())");
        });

        modelBuilder.Entity<DadosCliente>(entity =>
        {
            entity.HasKey(e => e.IdDadosCliente).HasName("PK__DadosCli__FFA9F32A7361F05F");

            entity.Property(e => e.IdDadosCliente).HasDefaultValueSql("(newid())");

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.DadosClientes)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__DadosClie__IdUsu__6754599E");
        });

        modelBuilder.Entity<Equipe>(entity =>
        {
            entity.HasKey(e => e.IdEquipe).HasName("PK__Equipe__D805241239BD572F");

            entity.Property(e => e.IdEquipe).HasDefaultValueSql("(newid())");
        });

        modelBuilder.Entity<Ligacao>(entity =>
        {
            entity.HasKey(e => e.IdLigacao).HasName("PK__Ligacao__FC0CEA8A833D74E4");

            entity.Property(e => e.IdLigacao).HasDefaultValueSql("(newid())");
            entity.Property(e => e.DataInicio).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.IdClienteNavigation).WithMany(p => p.Ligacaos)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Ligacao__IdClien__6D0D32F4");

            entity.HasOne(d => d.IdFuncionarioNavigation).WithMany(p => p.Ligacaos)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Ligacao__IdFunci__6C190EBB");

            entity.HasMany(d => d.IdAssuntos).WithMany(p => p.IdLigacaos)
                .UsingEntity<Dictionary<string, object>>(
                    "LigacaoAssunto",
                    r => r.HasOne<Assunto>().WithMany()
                        .HasForeignKey("IdAssunto")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__LigacaoAs__IdAss__73BA3083"),
                    l => l.HasOne<Ligacao>().WithMany()
                        .HasForeignKey("IdLigacao")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("FK__LigacaoAs__IdLig__72C60C4A"),
                    j =>
                    {
                        j.HasKey("IdLigacao", "IdAssunto").HasName("PK__LigacaoA__6575213EB04443CC");
                        j.ToTable("LigacaoAssunto");
                    });
        });

        modelBuilder.Entity<Registro>(entity =>
        {
            entity.HasKey(e => e.IdRegistro).HasName("PK__Registro__FFA45A99C8E3D2AE");

            entity.Property(e => e.IdRegistro).HasDefaultValueSql("(newid())");
            entity.Property(e => e.Prazo).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.IdAnaliseNavigation).WithMany(p => p.Registros)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Registro__IdAnal__05D8E0BE");

            entity.HasOne(d => d.IdFuncionarioNavigation).WithMany(p => p.Registros)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Registro__IdFunc__06CD04F7");
        });

        modelBuilder.Entity<Resultado>(entity =>
        {
            entity.HasKey(e => e.IdResultado).HasName("PK__Resultad__DAF71D0B4B3D185F");

            entity.Property(e => e.IdResultado).HasDefaultValueSql("(newid())");
            entity.Property(e => e.ValidadoEm).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.IdAnaliseNavigation).WithMany(p => p.Resultados)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Resultado__IdAna__0F624AF8");

            entity.HasOne(d => d.IdCriterioNavigation).WithMany(p => p.Resultados)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Resultado__IdCri__0E6E26BF");

            entity.HasOne(d => d.IdFuncionarioNavigation).WithMany(p => p.Resultados)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Resultado__IdFun__10566F31");
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.HasKey(e => e.IdUsuario).HasName("PK__Usuario__5B65BF97A83FC088");

            entity.Property(e => e.IdUsuario).HasDefaultValueSql("(newid())");

            entity.HasOne(d => d.IdEquipeNavigation).WithMany(p => p.Usuarios)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Usuario__IdEquip__619B8048");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using SenxCti.Api.Models;

namespace SenxCti.Api.Data;

public partial class SenxContext : DbContext
{
    public SenxContext(DbContextOptions<SenxContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Alerta> Alerta { get; set; }

    public virtual DbSet<Analise> Analises { get; set; }

    public virtual DbSet<Assunto> Assuntos { get; set; }

    public virtual DbSet<Criterio> Criterios { get; set; }

    public virtual DbSet<DadosCliente> DadosClientes { get; set; }

    public virtual DbSet<Equipe> Equipes { get; set; }

    public virtual DbSet<Ligacao> Ligacaos { get; set; }

    public virtual DbSet<Registro> Registros { get; set; }

    public virtual DbSet<Resultado> Resultados { get; set; }

    public virtual DbSet<Usuario> Usuarios { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Alerta>(entity =>
        {
            entity.HasKey(e => e.IdAlerta);

            entity.HasIndex(e => e.IdAnalise, "IX_Alerta_IdAnalise");

            entity.HasIndex(e => e.IdEquipe, "IX_Alerta_IdEquipe");

            entity.HasIndex(e => e.IdFuncionario, "IX_Alerta_IdFuncionario");

            entity.Property(e => e.IdAlerta).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.CriadoEm)
                .HasDefaultValueSql("timezone('UTC'::text, now())")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("Criado_em");
            entity.Property(e => e.Mensagem).HasMaxLength(255);
            entity.Property(e => e.Observacao).HasMaxLength(255);
            entity.Property(e => e.ResolvidoEm)
                .HasDefaultValueSql("timezone('UTC'::text, now())")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("Resolvido_em");
            entity.Property(e => e.Severidade).HasMaxLength(255);
            entity.Property(e => e.StatusValidacao).HasColumnName("Status_Validacao");
            entity.Property(e => e.Tipo).HasMaxLength(255);
            entity.Property(e => e.TrechoEvidencia).HasMaxLength(255);
            entity.Property(e => e.ValidadoEm)
                .HasDefaultValueSql("timezone('UTC'::text, now())")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("Validado_em");

            entity.HasOne(d => d.IdAnaliseNavigation).WithMany(p => p.Alerta)
                .HasForeignKey(d => d.IdAnalise)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.IdEquipeNavigation).WithMany(p => p.Alerta)
                .HasForeignKey(d => d.IdEquipe)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.IdFuncionarioNavigation).WithMany(p => p.Alerta)
                .HasForeignKey(d => d.IdFuncionario)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Analise>(entity =>
        {
            entity.HasKey(e => e.IdAnalise);

            entity.ToTable("Analise");

            entity.HasIndex(e => e.IdLigacao, "IX_Analise_IdLigacao");

            entity.Property(e => e.IdAnalise).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Compromissos).HasMaxLength(255);
            entity.Property(e => e.DataAnalise)
                .HasDefaultValueSql("timezone('UTC'::text, now())")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("Data_Analise");
            entity.Property(e => e.ModeloVersao)
                .HasMaxLength(200)
                .HasColumnName("Modelo_Versao");
            entity.Property(e => e.ProblemaNecessidade).HasMaxLength(255);
            entity.Property(e => e.ResolucaoEncaminhamento).HasMaxLength(255);
            entity.Property(e => e.ResumoTexto).HasColumnName("Resumo_Texto");
            entity.Property(e => e.TranscricaoTexto).HasColumnName("Transcricao_Texto");

            entity.HasOne(d => d.IdLigacaoNavigation).WithMany(p => p.Analises)
                .HasForeignKey(d => d.IdLigacao)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Assunto>(entity =>
        {
            entity.HasKey(e => e.IdAssunto);

            entity.ToTable("Assunto");

            entity.Property(e => e.IdAssunto).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Categoria).HasMaxLength(255);
            entity.Property(e => e.Descricao).HasMaxLength(255);
            entity.Property(e => e.Nome).HasMaxLength(255);
        });

        modelBuilder.Entity<Criterio>(entity =>
        {
            entity.HasKey(e => e.IdCriterio);

            entity.ToTable("Criterio");

            entity.Property(e => e.IdCriterio).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Descricao).HasMaxLength(255);
            entity.Property(e => e.Nome).HasMaxLength(255);
            entity.Property(e => e.RegraAvaliacao).HasMaxLength(255);
            entity.Property(e => e.Versao).HasMaxLength(255);
        });

        modelBuilder.Entity<DadosCliente>(entity =>
        {
            entity.HasKey(e => e.IdDadosCliente);

            entity.ToTable("DadosCliente");

            entity.HasIndex(e => e.Email, "IX_DadosCliente_Email").IsUnique();

            entity.HasIndex(e => e.IdUsuario, "IX_DadosCliente_IdUsuario");

            entity.HasIndex(e => e.Telefone, "IX_DadosCliente_Telefone").IsUnique();

            entity.Property(e => e.IdDadosCliente).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.Nome).HasMaxLength(255);
            entity.Property(e => e.Situacao).HasMaxLength(255);
            entity.Property(e => e.Telefone).HasMaxLength(11);

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.DadosClientes)
                .HasForeignKey(d => d.IdUsuario)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Equipe>(entity =>
        {
            entity.HasKey(e => e.IdEquipe);

            entity.ToTable("Equipe");

            entity.Property(e => e.IdEquipe).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Departamento).HasMaxLength(255);
            entity.Property(e => e.Nome).HasMaxLength(255);
        });

        modelBuilder.Entity<Ligacao>(entity =>
        {
            entity.HasKey(e => e.IdLigacao);

            entity.ToTable("Ligacao");

            entity.HasIndex(e => e.IdCliente, "IX_Ligacao_IdCliente");

            entity.HasIndex(e => e.IdFuncionario, "IX_Ligacao_IdFuncionario");

            entity.Property(e => e.IdLigacao).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.CaminhoArquivo)
                .HasMaxLength(255)
                .HasColumnName("Caminho_Arquivo");
            entity.Property(e => e.DataInicio)
                .HasDefaultValueSql("timezone('UTC'::text, now())")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("Data_Inicio");
            entity.Property(e => e.Direcao).HasMaxLength(255);
            entity.Property(e => e.HashAudio)
                .HasMaxLength(255)
                .HasColumnName("Hash_Audio");
            entity.Property(e => e.IdentificadorPabx)
                .HasMaxLength(255)
                .HasColumnName("IdentificadorPABX");
            entity.Property(e => e.NumeroDestino)
                .HasMaxLength(11)
                .HasColumnName("Numero_Destino");
            entity.Property(e => e.NumeroOrigem)
                .HasMaxLength(11)
                .HasColumnName("Numero_Origem");
            entity.Property(e => e.Stats).HasMaxLength(255);

            entity.HasOne(d => d.IdClienteNavigation).WithMany(p => p.Ligacaos)
                .HasForeignKey(d => d.IdCliente)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.IdFuncionarioNavigation).WithMany(p => p.Ligacaos)
                .HasForeignKey(d => d.IdFuncionario)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasMany(d => d.IdAssuntos).WithMany(p => p.IdLigacaos)
                .UsingEntity<Dictionary<string, object>>(
                    "LigacaoAssunto",
                    r => r.HasOne<Assunto>().WithMany()
                        .HasForeignKey("IdAssunto")
                        .OnDelete(DeleteBehavior.ClientSetNull),
                    l => l.HasOne<Ligacao>().WithMany()
                        .HasForeignKey("IdLigacao")
                        .OnDelete(DeleteBehavior.ClientSetNull),
                    j =>
                    {
                        j.HasKey("IdLigacao", "IdAssunto");
                        j.ToTable("LigacaoAssunto");
                        j.HasIndex(new[] { "IdAssunto" }, "IX_LigacaoAssunto_IdAssunto");
                    });
        });

        modelBuilder.Entity<Registro>(entity =>
        {
            entity.HasKey(e => e.IdRegistro);

            entity.ToTable("Registro");

            entity.HasIndex(e => e.IdAnalise, "IX_Registro_IdAnalise");

            entity.HasIndex(e => e.IdFuncionario, "IX_Registro_IdFuncionario");

            entity.Property(e => e.IdRegistro).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Descricao).HasMaxLength(255);
            entity.Property(e => e.Prazo)
                .HasDefaultValueSql("timezone('UTC'::text, now())")
                .HasColumnType("timestamp without time zone");
            entity.Property(e => e.Status).HasMaxLength(255);

            entity.HasOne(d => d.IdAnaliseNavigation).WithMany(p => p.Registros)
                .HasForeignKey(d => d.IdAnalise)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.IdFuncionarioNavigation).WithMany(p => p.Registros)
                .HasForeignKey(d => d.IdFuncionario)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Resultado>(entity =>
        {
            entity.HasKey(e => e.IdResultado);

            entity.ToTable("Resultado");

            entity.HasIndex(e => e.IdAnalise, "IX_Resultado_IdAnalise");

            entity.HasIndex(e => e.IdCriterio, "IX_Resultado_IdCriterio");

            entity.HasIndex(e => e.IdFuncionario, "IX_Resultado_IdFuncionario");

            entity.Property(e => e.IdResultado).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Classificacao).HasMaxLength(255);
            entity.Property(e => e.Justificativa).HasMaxLength(255);
            entity.Property(e => e.ObservacaoValidacao).HasMaxLength(255);
            entity.Property(e => e.ResultadoValidado).HasMaxLength(255);
            entity.Property(e => e.StatusValidacao).HasMaxLength(255);
            entity.Property(e => e.TrechoEvidencia).HasMaxLength(255);
            entity.Property(e => e.ValidadoEm)
                .HasDefaultValueSql("timezone('UTC'::text, now())")
                .HasColumnType("timestamp without time zone")
                .HasColumnName("Validado_em");

            entity.HasOne(d => d.IdAnaliseNavigation).WithMany(p => p.Resultados)
                .HasForeignKey(d => d.IdAnalise)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.IdCriterioNavigation).WithMany(p => p.Resultados)
                .HasForeignKey(d => d.IdCriterio)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.IdFuncionarioNavigation).WithMany(p => p.Resultados)
                .HasForeignKey(d => d.IdFuncionario)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.HasKey(e => e.IdUsuario);

            entity.ToTable("Usuario");

            entity.HasIndex(e => e.Email, "IX_Usuario_Email").IsUnique();

            entity.HasIndex(e => e.IdEquipe, "IX_Usuario_IdEquipe");

            entity.Property(e => e.IdUsuario).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Cargo).HasMaxLength(255);
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.Imagem).HasMaxLength(255);
            entity.Property(e => e.Nome).HasMaxLength(200);
            entity.Property(e => e.Senha).HasMaxLength(40);

            entity.HasOne(d => d.IdEquipeNavigation).WithMany(p => p.Usuarios)
                .HasForeignKey(d => d.IdEquipe)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

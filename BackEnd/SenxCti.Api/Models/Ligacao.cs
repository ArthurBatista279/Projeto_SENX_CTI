using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Ligacao
{
    public Guid IdLigacao { get; set; }

    public Guid IdFuncionario { get; set; }

    public Guid IdCliente { get; set; }

    public DateTime DataInicio { get; set; }

    public TimeOnly Duracao { get; set; }

    public string NumeroOrigem { get; set; } = null!;

    public string NumeroDestino { get; set; } = null!;

    public string Stats { get; set; } = null!;

    public string HashAudio { get; set; } = null!;

    public string CaminhoArquivo { get; set; } = null!;

    public string IdentificadorPabx { get; set; } = null!;

    public string Direcao { get; set; } = null!;

    public virtual ICollection<Analise> Analise { get; set; } = new List<Analise>();

    public virtual DadosCliente IdClienteNavigation { get; set; } = null!;

    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;

    public virtual ICollection<Assunto> IdAssunto { get; set; } = new List<Assunto>();
}

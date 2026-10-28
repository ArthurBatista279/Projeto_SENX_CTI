using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Alerta
{
    public Guid IdAlerta { get; set; }

    public Guid IdAnalise { get; set; }

    public Guid IdEquipe { get; set; }

    public Guid IdFuncionario { get; set; }

    public string Tipo { get; set; } = null!;

    public string Severidade { get; set; } = null!;

    public string Mensagem { get; set; } = null!;

    public bool StatusTratamento { get; set; }

    public bool StatusValidacao { get; set; }

    public DateTime ValidadoEm { get; set; }

    public string Observacao { get; set; } = null!;

    public DateTime CriadoEm { get; set; }

    public DateTime ResolvidoEm { get; set; }

    public string Justificativa { get; set; } = null!;

    public string TrechoEvidencia { get; set; } = null!;

    public virtual Analise IdAnaliseNavigation { get; set; } = null!;

    public virtual Equipe IdEquipeNavigation { get; set; } = null!;

    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;
}

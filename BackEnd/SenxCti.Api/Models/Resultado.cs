using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Resultado
{
    public Guid IdResultado { get; set; }

    public Guid IdCriterio { get; set; }

    public Guid IdAnalise { get; set; }

    public Guid IdFuncionario { get; set; }

    public string Classificacao { get; set; } = null!;

    public int Score { get; set; }

    public string Justificativa { get; set; } = null!;

    public string TrechoEvidencia { get; set; } = null!;

    public string ResultadoValidado { get; set; } = null!;

    public string StatusValidacao { get; set; } = null!;

    public DateTime ValidadoEm { get; set; }

    public string ObservacaoValidacao { get; set; } = null!;

    public virtual Analise IdAnaliseNavigation { get; set; } = null!;

    public virtual Criterio IdCriterioNavigation { get; set; } = null!;

    public virtual Usuario IdFuncionarioNavigation { get; set; } = null!;
}

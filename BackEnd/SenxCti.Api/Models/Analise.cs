using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Analise
{
    public Guid IdAnalise { get; set; }

    public Guid IdLigacao { get; set; }

    public DateTime DataAnalise { get; set; }

    public string ResolucaoEncaminhamento { get; set; } = null!;

    public bool? StatusProcessamento { get; set; }

    public string ModeloVersao { get; set; } = null!;

    public string TranscricaoTexto { get; set; } = null!;

    public string ResumoTexto { get; set; } = null!;

    public bool Cancelamento { get; set; }

    public bool Oportunidade { get; set; }

    public int ScoreGeral { get; set; }

    public string ProblemaNecessidade { get; set; } = null!;

    public string Compromissos { get; set; } = null!;

    public virtual ICollection<Alerta> Alerta { get; set; } = new List<Alerta>();

    public virtual Ligacao IdLigacaoNavigation { get; set; } = null!;

    public virtual ICollection<Registro> Registro { get; set; } = new List<Registro>();

    public virtual ICollection<Resultado> Resultado { get; set; } = new List<Resultado>();
}

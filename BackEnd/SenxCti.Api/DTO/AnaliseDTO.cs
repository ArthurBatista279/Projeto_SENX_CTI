namespace SenxCti.Api.DTO;

public class AnaliseDTO
{
    public DateTime? DataAnalise { get; set; }
    public String? ResolucaoEncaminhamento { get; set; }
    public Boolean? StatusProcessamento { get; set; }
    public String? ModeloVersao { get; set; }
    public String? TranscricaoTexto { get; set; }
    public String? ResumoTexto { get; set; }
    public Boolean? Cancelamento { get; set; }
    public Boolean? Oportunidade { get; set; }
    public Int32? ScoreGeral { get; set; }
    public String? ProblemaNecessidade { get; set; }
    public String? Compromissos { get; set; }
}

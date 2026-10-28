namespace SenxCti.Api.DTO;

public class ResultadoDTO
{
    public String? Classificacao { get; set; }
    public Int32? Score { get; set; }
    public String? Justificativa { get; set; }
    public String? TrechoEvidencia { get; set; }
    public String? ResultadoValidado { get; set; }
    public String? StatusValidacao { get; set; }
    public DateTime? ValidadoEm { get; set; }
    public String? ObservacaoValidacao { get; set; }
}

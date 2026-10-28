namespace SenxCti.Api.DTO;

public class AlertaDTO
{
    public String? Tipo { get; set; }
    public String? Severidade { get; set; }
    public String? Mensagem { get; set; }
    public Boolean? StatusTratamento { get; set; }
    public Boolean? StatusValidacao { get; set; }
    public DateTime? ValidadoEm { get; set; }
    public String? Observacao { get; set; }
    public DateTime? CriadoEm { get; set; }
    public DateTime? ResolvidoEm { get; set; }
    public String? Justificativa { get; set; }
    public String? TrechoEvidencia { get; set; }
}

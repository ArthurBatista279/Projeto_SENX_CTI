namespace SenxCti.Api.DTO;

public class LicagaoDTO
{
    public DateTime? DataInicio { get; set; }
    public TimeOnly? Duracao { get; set; }
    public String? NumeroOrigem { get; set; }
    public String? NumeroDestino { get; set; }
    public String? Stats { get; set; }
    public String? HashAudio { get; set; }
    public String? CaminhoArquivo { get; set; }
    public String? IdentificadorPabx { get; set; }
    public String? Direcao { get; set; }
}

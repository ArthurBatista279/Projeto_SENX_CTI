namespace SenxCti.Api.Services.Ai;

public interface IAiAnalysisService
{
    Task<AiAnalysisResult> ProcessAudioAsync(string audioFilePath, CancellationToken ct);
}

public sealed record AiCriterionScore(Guid IdCriterio, int Score, string Justificativa);

public sealed record AiAnalysisResult(string TranscricaoTexto, string ResumoTexto, bool Cancelamento,
    bool Oportunidade, int ScoreGeral, string ProblemaNecessidade, string Compromissos,
    string ResolucaoEncaminhamento, string ModeloVersao, bool StatusProcessamento = true, bool Simulada = false)
{
    public IReadOnlyList<AiCriterionScore> Resultados { get; init; } = [];
}

public sealed class AiProcessingException(string message) : Exception(message);

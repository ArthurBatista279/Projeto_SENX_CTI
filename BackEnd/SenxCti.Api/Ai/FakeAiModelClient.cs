using SenxCti.Api.Contracts;

namespace SenxCti.Api.Ai;

public sealed class FakeAiModelClient : IAiModelClient
{
    public string Provider => "fake";

    public Task<AiAnalysisResponse> AnalyzeAsync(AiAnalysisRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var normalized = string.Join(' ', request.Transcript.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        var preview = normalized.Length <= 180 ? normalized : normalized[..177] + "...";
        return Task.FromResult(new AiAnalysisResponse(
            Guid.NewGuid(), Provider, $"Resumo simulado: {preview}",
            ["atendimento", "teste-local"], "normal", DateTimeOffset.UtcNow));
    }
}

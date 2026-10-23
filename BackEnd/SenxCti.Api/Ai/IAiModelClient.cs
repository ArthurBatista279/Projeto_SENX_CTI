using SenxCti.Api.Contracts;

namespace SenxCti.Api.Ai;

public interface IAiModelClient
{
    string Provider { get; }
    Task<AiAnalysisResponse> AnalyzeAsync(AiAnalysisRequest request, CancellationToken cancellationToken);
}

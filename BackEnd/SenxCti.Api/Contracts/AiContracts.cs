namespace SenxCti.Api.Contracts;

public sealed record AiAnalysisRequest(string Transcript);
public sealed record AiAnalysisResponse(Guid AnalysisId, string Provider, string Summary,
    IReadOnlyList<string> Topics, string Criticality, DateTimeOffset ProcessedAtUtc);

using System.Net;
using System.Text.Json;

namespace TranscribeTest;

public sealed class ProviderQuotaException(TimeSpan? retryAfter, HttpStatusCode? status = null)
    : HttpRequestException("Cota ou limite de requisições/tokens atingido.", null, status)
{
    public TimeSpan? RetryAfter { get; } = retryAfter;
}

public static class ProviderFailure
{
    public static bool IsQuotaMessage(string? message)
    {
        if (message is null) return false;
        return new[] { "resource_exhausted", "resource exhausted", "quota", "rate_limit", "rate limit",
            "too many requests", "insufficient_credit", "insufficient credit", "payment_required", "credit balance" }
            .Any(marker => message.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }

    public static void Check(HttpResponseMessage response, string body)
    {
        if ((int)response.StatusCode is 429 or 402 || (!response.IsSuccessStatusCode && IsQuotaMessage(body)))
        {
            var retry = response.Headers.RetryAfter;
            TimeSpan? wait = retry?.Delta ?? (retry?.Date is { } date ? date - DateTimeOffset.UtcNow : null);
            if (wait is null)
            {
                // Gemini inclui google.rpc.RetryInfo no JSON em algumas respostas de quota.
                try
                {
                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.Object
                        && error.TryGetProperty("details", out var details) && details.ValueKind == JsonValueKind.Array)
                        foreach (var detail in details.EnumerateArray())
                            if (detail.TryGetProperty("retryDelay", out var delay) && delay.ValueKind == JsonValueKind.String
                                && double.TryParse(delay.GetString()?.TrimEnd('s'), System.Globalization.NumberStyles.Float,
                                    System.Globalization.CultureInfo.InvariantCulture, out var seconds)
                                && double.IsFinite(seconds) && seconds > 0 && seconds <= 31536000)
                                wait = TimeSpan.FromSeconds(seconds);
                }
                catch (JsonException) { }
            }
            throw new ProviderQuotaException(wait, response.StatusCode);
        }
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"HTTP {(int)response.StatusCode}.", null, response.StatusCode);

        // Apenas metadados de erro; nunca procurar palavras de quota dentro da transcrição.
        using var payload = JsonDocument.Parse(body);
        var root = payload.RootElement;
        if (root.TryGetProperty("error", out var apiError) && apiError.ValueKind is not (JsonValueKind.Null or JsonValueKind.False))
        {
            if (IsQuotaMessage(apiError.ToString())) throw new ProviderQuotaException(null);
            throw new InvalidDataException("A IA retornou um erro no conteúdo da resposta.");
        }
        if (root.TryGetProperty("status", out var status) && status.ValueKind == JsonValueKind.String
            && status.GetString() is "incomplete" or "failed" or "cancelled")
            throw new InvalidDataException("A IA não concluiu a resposta; tentando outro modelo.");
    }
}

using System.Text.Json;
using Microsoft.Extensions.Options;

namespace TranscribeTest;

public sealed class TranscriptionRouter(GeminiTranscribeService gemini, BackupTranscribeService backup,
    IOptions<GeminiOptions> geminiOptions, IOptions<FallbackOptions> options,
    ILogger<TranscriptionRouter> logger, NvidiaTranscribeService? nvidia = null, ProviderQuotaState? quotas = null)
{
    private readonly ProviderQuotaState quotaState = quotas ?? new ProviderQuotaState();
    public async Task<TranscriptionResult> TranscribeAsync(IFormFile file, TranscriptionSettings settings,
        bool backupOnly, CancellationToken ct, string? preferredProvider = null)
    {
        var config = options.Value;
        var notices = new List<string>();
        var catalog = ProviderCatalog.Get(geminiOptions.Value, config);
        var providers = catalog.Where(p => !backupOnly || p.Name != "Gemini").ToArray();
        if (!string.IsNullOrWhiteSpace(preferredProvider) && preferredProvider != "auto")
        {
            if (!catalog.Any(p => p.Name == preferredProvider))
                throw new ArgumentException("IA desconhecida.");
            providers = providers.OrderBy(p => p.Name == preferredProvider ? 0 : 1).ToArray();
        }
        foreach (var entry in providers)
        {
            var provider = entry.Name;
            ct.ThrowIfCancellationRequested();
            var key = entry.Key;
            if (!FallbackOptions.HasKey(key))
            {
                notices.Add($"{provider}: chave não configurada.");
                continue;
            }
            var remaining = quotaState.Remaining(provider, key);
            if (remaining > TimeSpan.Zero)
            {
                notices.Add($"{entry.Label}: cota atingida; nova tentativa em {Math.Ceiling(remaining.TotalSeconds)}s. Usando outra IA.");
                continue;
            }
            if (!entry.Diarization && settings.Diarization)
            {
                notices.Add($"{entry.Label} ignorado: não oferece diarização nesta integração.");
                continue;
            }
            if (!entry.Timestamps && settings.Timestamps)
            {
                notices.Add($"{entry.Label} ignorado: não oferece timestamps por palavra nesta integração.");
                continue;
            }
            var maxMb = entry.MaxFileSizeMb;
            if (provider != "Gemini" && file.Length > maxMb * 1024L * 1024)
            {
                notices.Add($"{provider} ignorado: arquivo excede o limite configurado de {maxMb} MiB.");
                continue;
            }

            var seconds = entry == providers[0] && !backupOnly ? config.PrimaryTimeoutSeconds : config.BackupTimeoutSeconds;
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct);
            deadline.CancelAfter(TimeSpan.FromSeconds(seconds));
            try
            {
                // Uma nova leitura para cada tentativa: timeout/upload não consome o áudio da próxima IA.
                await using var audio = file.OpenReadStream();
                var mime = string.IsNullOrWhiteSpace(file.ContentType) ? "audio/mpeg" : file.ContentType;
                var result = provider == "Gemini"
                    ? await gemini.TranscribeAsync(audio, mime, settings.Mode, settings.Diarization,
                        settings.Timestamps, settings.Languages, settings.Vocabulary, deadline.Token)
                    : provider.StartsWith("Nvidia", StringComparison.Ordinal)
                        ? await (nvidia ?? throw new InvalidDataException("Serviço NVIDIA não registrado."))
                            .TranscribeAsync(provider, audio, file.FileName, settings, deadline.Token)
                        : await backup.TranscribeAsync(provider, audio, mime, file.FileName, settings, deadline.Token);
                if (provider != "Gemini")
                    notices.Add("A formatação smart/verbatim e as dicas de idioma/vocabulário podem variar entre provedores.");
                return result with { Provider = provider, ProviderLabel = entry.Label, Model = entry.Model, Notices = notices.ToArray() };
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                notices.Add($"{provider}: tempo limite de {seconds}s excedido; tentando a próxima IA.");
            }
            catch (ProviderQuotaException ex) when (!ct.IsCancellationRequested)
            {
                var wait = ex.RetryAfter ?? TimeSpan.FromSeconds(config.QuotaCooldownSeconds);
                quotaState.Block(provider, key, wait);
                notices.Add($"{entry.Label}: cota/tokens esgotados (HTTP {(int?)ex.StatusCode}); troca automática. Pausa de {Math.Ceiling(Math.Max(1, wait.TotalSeconds))}s.");
            }
            catch (Grpc.Core.RpcException) when (ct.IsCancellationRequested)
            { ct.ThrowIfCancellationRequested(); throw; }
            catch (Grpc.Core.RpcException ex)
            {
                if (ex.StatusCode == Grpc.Core.StatusCode.ResourceExhausted)
                    quotaState.Block(provider, key, TimeSpan.FromSeconds(config.QuotaCooldownSeconds));
                notices.Add($"{entry.Label}: gRPC {ex.StatusCode}; tentando a próxima IA.");
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidDataException or KeyNotFoundException)
            {
                // Não expor corpo de erro remoto, credenciais ou transcrição em logs.
                var reason = ex is HttpRequestException { StatusCode: { } status }
                    ? $"HTTP {(int)status}" : "falha de conexão ou resposta inválida";
                notices.Add($"{provider}: {reason}; tentando a próxima IA.");
            }
            logger.LogWarning("Transcrição: {Notice}", notices[^1]);
        }
        throw new TranscriptionUnavailableException("Nenhuma IA conseguiu transcrever. " + string.Join(" ", notices));
    }
}

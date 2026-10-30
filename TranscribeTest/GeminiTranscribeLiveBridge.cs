using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace TranscribeTest;

public sealed record LiveSettings(string[] LanguageCodes, string Mode, string[] CustomVocabulary);

/// <summary>
/// Ponte WebSocket: navegador (PCM 16 kHz) -> este servidor -> Gemini Live API (gemini-3.5-transcribe-live).
/// A API key fica só no servidor.
/// </summary>
public sealed class GeminiTranscribeLiveBridge(
    IOptions<GeminiOptions> options,
    IOptions<FallbackOptions> fallbackOptions,
    ILogger<GeminiTranscribeLiveBridge> logger,
    ProviderQuotaState quotas)
{
    private const string BaseUrl =
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

    public async Task RunAsync(WebSocket client, LiveSettings settings, CancellationToken ct)
    {
        var o = options.Value;
        if (quotas.Remaining("Gemini", o.ApiKey) > TimeSpan.Zero)
        {
            await SendEventAsync(client, "error", "Gemini está temporariamente sem cota. Acionando outra IA.", ct);
            await CloseQuietlyAsync(client);
            return;
        }

        using var gemini = new ClientWebSocket();
        try
        {
            if (!FallbackOptions.HasKey(o.ApiKey)) throw new InvalidOperationException("Chave Gemini não configurada.");
            using var setupTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            setupTimeout.CancelAfter(TimeSpan.FromSeconds(fallbackOptions.Value.LiveConnectTimeoutSeconds));
            await gemini.ConnectAsync(new Uri($"{BaseUrl}?key={o.ApiKey}"), setupTimeout.Token);
            await SendJsonAsync(gemini, BuildSetup(o, settings), setupTimeout.Token);
            while (true)
            {
                var (type, data) = await ReceiveMessageAsync(gemini, setupTimeout.Token);
                if (type == WebSocketMessageType.Close)
                {
                    RememberQuota(gemini.CloseStatusDescription);
                    throw new IOException("Gemini recusou a sessão.");
                }
                using var setup = JsonDocument.Parse(data);
                if (setup.RootElement.TryGetProperty("error", out var setupError))
                {
                    RememberQuota(setupError.ToString());
                    throw new IOException("Gemini recusou a configuração.");
                }
                if (setup.RootElement.TryGetProperty("setupComplete", out _)) break;
            }
            await SendEventAsync(client, "ready", "Gemini", ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
        catch (Exception ex)
        {
            RememberQuota(ex.Message);
            logger.LogWarning("Falha ao conectar no Gemini: {ErrorType}", ex.GetType().Name);
            await SendEventAsync(client, "error", "Gemini indisponível ou demorou para conectar.", ct);
            await CloseQuietlyAsync(client);
            return;
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var up = ClientToGeminiAsync(client, gemini, cts.Token);
        var down = GeminiToClientAsync(gemini, client, cts.Token);

        await Task.WhenAny(up, down);

        // Se o Gemini encerrou, avisa o motivo ao navegador
        if (gemini.State is WebSocketState.CloseReceived or WebSocketState.Closed && gemini.CloseStatus is not null)
        {
            var reason = $"Gemini encerrou a sessão ({gemini.CloseStatus}): {gemini.CloseStatusDescription}";
            RememberQuota(gemini.CloseStatusDescription);
            logger.LogWarning("{Reason}", reason);
            if (client.State == WebSocketState.Open)
                await SendEventAsync(client, "error", reason, CancellationToken.None);
        }

        cts.Cancel();
        try { await Task.WhenAll(up, down); }
        catch (OperationCanceledException) { }
        catch (Exception ex) when (ex is WebSocketException or InvalidDataException or IOException)
        { logger.LogWarning("WebSocket encerrado: {ErrorType}", ex.GetType().Name); }

        await CloseQuietlyAsync(gemini);
        await CloseQuietlyAsync(client);
    }

    private static JsonObject BuildSetup(GeminiOptions o, LiveSettings s)
    {
        var transcription = new JsonObject
        {
            ["languageCodes"] = new JsonArray(s.LanguageCodes.Select(l => (JsonNode)JsonValue.Create(l)!).ToArray()),
            ["mode"] = s.Mode // "SMART" ou "VERBATIM"
        };

        if (s.CustomVocabulary.Length > 0)
            transcription["customVocabulary"] =
                new JsonArray(s.CustomVocabulary.Select(v => (JsonNode)JsonValue.Create(v)!).ToArray());

        return new JsonObject
        {
            ["setup"] = new JsonObject
            {
                ["model"] = $"models/{o.TranscribeLiveModel}",
                ["generationConfig"] = new JsonObject { ["responseModalities"] = new JsonArray("TEXT") },
                ["inputAudioTranscription"] = transcription
            }
        };
    }

    // Navegador -> Gemini
    // Frame binário = PCM 16-bit mono 16 kHz. Frame de texto "end" = fim da fala (audioStreamEnd).
    private async Task ClientToGeminiAsync(WebSocket client, ClientWebSocket gemini, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && client.State == WebSocketState.Open)
        {
            var (type, data) = await ReceiveMessageAsync(client, ct);
            if (type == WebSocketMessageType.Close) return;

            if (type == WebSocketMessageType.Binary && data.Length > 0)
            {
                await SendJsonAsync(gemini, new JsonObject
                {
                    ["realtimeInput"] = new JsonObject
                    {
                        ["audio"] = new JsonObject
                        {
                            ["data"] = Convert.ToBase64String(data),
                            ["mimeType"] = "audio/pcm;rate=16000"
                        }
                    }
                }, ct);
            }
            else if (type == WebSocketMessageType.Text && Encoding.UTF8.GetString(data).Trim() == "end")
            {
                await SendJsonAsync(gemini, new JsonObject
                {
                    ["realtimeInput"] = new JsonObject { ["audioStreamEnd"] = true }
                }, ct);
            }
        }
    }

    // Gemini -> Navegador: { type: "interim" | "final" | "error", text }
    private async Task GeminiToClientAsync(ClientWebSocket gemini, WebSocket client, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && gemini.State == WebSocketState.Open)
        {
            var (type, data) = await ReceiveMessageAsync(gemini, ct);
            if (type == WebSocketMessageType.Close) return;

            JsonDocument doc;
            try { doc = JsonDocument.Parse(data); }
            catch (JsonException) { continue; }

            using (doc)
            {
                if (doc.RootElement.TryGetProperty("error", out var apiError))
                {
                    RememberQuota(apiError.ToString());
                    await SendEventAsync(client, "error", "Gemini retornou um erro; acionando reserva.", ct);
                    return;
                }
                if (!doc.RootElement.TryGetProperty("serverContent", out var sc)) continue;

                if (sc.TryGetProperty("interimInputTranscription", out var interim) &&
                    interim.TryGetProperty("text", out var it))
                    await SendEventAsync(client, "interim", it.GetString(), ct);

                if (sc.TryGetProperty("inputTranscription", out var final) &&
                    final.TryGetProperty("text", out var ft))
                    await SendEventAsync(client, "final", ft.GetString(), ct);
            }
        }
    }

    private void RememberQuota(string? message)
    {
        if (ProviderFailure.IsQuotaMessage(message) || message?.Contains("429", StringComparison.Ordinal) == true)
            quotas.Block("Gemini", options.Value.ApiKey, TimeSpan.FromSeconds(fallbackOptions.Value.QuotaCooldownSeconds));
    }

    private static Task SendEventAsync(WebSocket ws, string type, string? text, CancellationToken ct) =>
        ws.State == WebSocketState.Open
            ? ws.SendAsync(JsonSerializer.SerializeToUtf8Bytes(new { type, text }),
                WebSocketMessageType.Text, true, ct)
            : Task.CompletedTask;

    private static Task SendJsonAsync(ClientWebSocket ws, JsonNode payload, CancellationToken ct) =>
        ws.SendAsync(Encoding.UTF8.GetBytes(payload.ToJsonString()), WebSocketMessageType.Text, true, ct);

    private static async Task<(WebSocketMessageType Type, byte[] Data)> ReceiveMessageAsync(
        WebSocket ws, CancellationToken ct)
    {
        var buffer = new byte[16 * 1024];
        using var ms = new MemoryStream();
        WebSocketReceiveResult result;
        do
        {
            result = await ws.ReceiveAsync(buffer, ct);
            if (result.MessageType == WebSocketMessageType.Close)
                return (WebSocketMessageType.Close, Array.Empty<byte>());
            ms.Write(buffer, 0, result.Count);
            if (ms.Length > 4 * 1024 * 1024) throw new InvalidDataException("Mensagem WebSocket excede 4 MiB.");
        } while (!result.EndOfMessage);

        return (result.MessageType, ms.ToArray());
    }

    private static async Task CloseQuietlyAsync(WebSocket ws)
    {
        try
        {
            if (ws.State is WebSocketState.Open or WebSocketState.CloseReceived)
            {
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", timeout.Token);
            }
        }
        catch { /* ignorar */ }
    }
}

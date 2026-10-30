using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace TranscribeTest;

public sealed record WordInfo(string Text, string? Speaker, string? Start, string? End);

public sealed record TranscriptionResult(string Text, List<WordInfo> Words, string Raw)
{
    public string Provider { get; init; } = "Gemini";
    public string ProviderLabel { get; init; } = "Gemini Transcribe";
    public string Model { get; init; } = "";
    public string[] Notices { get; init; } = [];
}

/// <summary>
/// Transcrição de arquivos de áudio: Files API (upload) + Interactions API (gemini-3.5-transcribe).
/// </summary>
public sealed class GeminiTranscribeService(HttpClient http, IOptions<GeminiOptions> options)
{
    private const string Host = "https://generativelanguage.googleapis.com";
    private readonly GeminiOptions _o = options.Value;

    public async Task<TranscriptionResult> TranscribeAsync(
        Stream audio,
        string mimeType,
        string mode,                    // "smart" ou "verbatim"
        bool diarization,
        bool wordTimestamps,
        string[] languageCodes,         // vazio = detecção automática
        string[] customVocabulary,
        CancellationToken ct)
    {
        var (fileUri, fileMime) = await UploadAsync(audio, mimeType, ct);

        var transcription = new JsonObject
        {
            ["language_codes"] = new JsonArray(languageCodes.Select(l => (JsonNode)JsonValue.Create(l)!).ToArray())
        };

        if (diarization || wordTimestamps)
        {
            // Diarização e timestamps exigem "verbatim" e não combinam com custom_vocabulary.
            var verbatim = new JsonObject { ["type"] = "verbatim" };
            if (diarization) verbatim["diarization_mode"] = "speaker";
            if (wordTimestamps) verbatim["timestamp_granularities"] = new JsonArray("word");
            transcription["mode"] = verbatim;
        }
        else
        {
            transcription["mode"] = mode == "smart"
                ? (JsonNode)JsonValue.Create("smart")!
                : new JsonObject { ["type"] = "verbatim" };

            if (customVocabulary.Length > 0)
                transcription["custom_vocabulary"] =
                    new JsonArray(customVocabulary.Select(v => (JsonNode)JsonValue.Create(v)!).ToArray());
        }

        var body = new JsonObject
        {
            ["model"] = _o.TranscribeModel,
            ["input"] = new JsonArray(new JsonObject
            {
                ["type"] = "audio",
                ["uri"] = fileUri,
                ["mime_type"] = fileMime
            }),
            ["generation_config"] = new JsonObject { ["transcription_config"] = transcription }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{Host}/v1beta/interactions")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json")
        };
        req.Headers.Add("x-goog-api-key", _o.ApiKey);

        using var res = await http.SendAsync(req, ct);
        var json = await res.Content.ReadAsStringAsync(ct);
        ProviderFailure.Check(res, json);

        return Parse(json);
    }

    // Upload "resumable" da Files API
    private async Task<(string Uri, string MimeType)> UploadAsync(Stream audio, string mimeType, CancellationToken ct)
    {
        // IFormFile fornece um stream com tamanho conhecido, com arquivos grandes armazenados
        // temporariamente em disco pelo ASP.NET. Não duplicar até 2 GB em arrays na memória.
        if (!audio.CanSeek) throw new InvalidDataException("O upload exige um stream com tamanho conhecido.");
        var length = audio.Length - audio.Position;

        using var start = new HttpRequestMessage(HttpMethod.Post, $"{Host}/upload/v1beta/files")
        {
            Content = new StringContent("{\"file\":{\"display_name\":\"audio\"}}", Encoding.UTF8, "application/json")
        };
        start.Headers.Add("x-goog-api-key", _o.ApiKey);
        start.Headers.Add("X-Goog-Upload-Protocol", "resumable");
        start.Headers.Add("X-Goog-Upload-Command", "start");
        start.Headers.Add("X-Goog-Upload-Header-Content-Length", length.ToString(System.Globalization.CultureInfo.InvariantCulture));
        start.Headers.Add("X-Goog-Upload-Header-Content-Type", mimeType);

        using var startRes = await http.SendAsync(start, ct);
        if (!startRes.IsSuccessStatusCode)
            ProviderFailure.Check(startRes, await startRes.Content.ReadAsStringAsync(ct));

        var uploadUrl = startRes.Headers.GetValues("X-Goog-Upload-URL").First();

        using var upload = new HttpRequestMessage(HttpMethod.Post, uploadUrl)
        {
            Content = new StreamContent(audio)
        };
        upload.Content.Headers.ContentLength = length;
        upload.Content.Headers.ContentType = new MediaTypeHeaderValue(mimeType);
        upload.Headers.Add("X-Goog-Upload-Offset", "0");
        upload.Headers.Add("X-Goog-Upload-Command", "upload, finalize");

        using var upRes = await http.SendAsync(upload, ct);
        var upJson = await upRes.Content.ReadAsStringAsync(ct);
        ProviderFailure.Check(upRes, upJson);

        using var doc = JsonDocument.Parse(upJson);
        var file = doc.RootElement.GetProperty("file");
        return (file.GetProperty("uri").GetString()!,
                file.TryGetProperty("mimeType", out var m) ? m.GetString()! : mimeType);
    }

    private static TranscriptionResult Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var text = new StringBuilder();
        var words = new List<WordInfo>();

        if (root.TryGetProperty("steps", out var steps))
        {
            foreach (var step in steps.EnumerateArray())
            {
                if (!step.TryGetProperty("content", out var contents)) continue;
                foreach (var c in contents.EnumerateArray())
                {
                    if (c.TryGetProperty("text", out var t)) text.Append(t.GetString());

                    if (!c.TryGetProperty("annotations", out var anns)) continue;
                    foreach (var a in anns.EnumerateArray())
                    {
                        if (a.TryGetProperty("type", out var ty) && ty.GetString() == "word_info")
                            words.Add(new WordInfo(
                                a.TryGetProperty("text", out var wt) ? wt.GetString() ?? "" : "",
                                a.TryGetProperty("speaker", out var s) ? s.GetString() : null,
                                a.TryGetProperty("start_offset", out var st) ? st.GetString() : null,
                                a.TryGetProperty("end_offset", out var en) ? en.GetString() : null));
                    }
                }
            }
        }

        // Plano B: alguns formatos de resposta trazem o texto pronto
        if (text.Length == 0 && root.TryGetProperty("output_text", out var ot))
            text.Append(ot.GetString());

        var pretty = JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true });
        return new TranscriptionResult(text.ToString(), words, pretty);
    }
}

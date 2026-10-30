using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace TranscribeTest;

public sealed class BackupTranscribeService(HttpClient http, IOptions<FallbackOptions> options)
{
    public async Task<TranscriptionResult> TranscribeAsync(string provider, Stream audio, string mime,
        string fileName, TranscriptionSettings settings, CancellationToken ct)
    {
        using var request = provider.StartsWith("Deepgram", StringComparison.Ordinal)
            ? BuildDeepgram(audio, mime, settings, provider)
            : BuildGroq(audio, mime, fileName, settings, provider);
        using var response = await http.SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        ProviderFailure.Check(response, json);

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var words = new List<WordInfo>();
        string text;
        if (provider.StartsWith("Deepgram", StringComparison.Ordinal))
        {
            var alternative = root.GetProperty("results").GetProperty("channels")[0]
                .GetProperty("alternatives")[0];
            text = alternative.GetProperty("transcript").GetString() ?? "";
            if ((settings.Diarization || settings.Timestamps) && alternative.TryGetProperty("words", out var list))
                foreach (var w in list.EnumerateArray())
                    words.Add(new WordInfo(
                        w.TryGetProperty("punctuated_word", out var punctuated) ? punctuated.GetString() ?? "" : w.GetProperty("word").GetString() ?? "",
                        settings.Diarization && w.TryGetProperty("speaker", out var speaker) ? $"spk_{speaker}" : null,
                        settings.Timestamps ? Offset(w, "start") : null,
                        settings.Timestamps ? Offset(w, "end") : null));
        }
        else
        {
            text = root.GetProperty("text").GetString() ?? "";
            if (settings.Timestamps && root.TryGetProperty("words", out var list))
                foreach (var w in list.EnumerateArray())
                    words.Add(new WordInfo(w.GetProperty("word").GetString() ?? "", null,
                        Offset(w, "start"), Offset(w, "end")));
        }

        return new TranscriptionResult(text, words, json) { Provider = provider };
    }

    private HttpRequestMessage BuildDeepgram(Stream audio, string mime, TranscriptionSettings s, string provider)
    {
        var config = provider == "DeepgramNova2" ? options.Value.DeepgramNova2 : options.Value.Deepgram;
        var query = new List<KeyValuePair<string, string?>>
        {
            new("model", config.Model), new("smart_format", s.Mode == "smart" ? "true" : "false"),
            new("punctuate", "true"), new("diarize", s.Diarization ? "true" : "false")
        };
        if (s.Languages.Length == 1) query.Add(new("language", s.Languages[0]));
        else query.Add(new("detect_language", "true"));
        if (!s.Diarization && !s.Timestamps)
            foreach (var term in s.Vocabulary) query.Add(new(provider == "DeepgramNova2" ? "keywords" : "keyterm", term));
        var request = new HttpRequestMessage(HttpMethod.Post,
            "https://api.deepgram.com/v1/listen" + QueryString.Create(query));
        request.Headers.Authorization = new AuthenticationHeaderValue("Token", ProviderCatalog.Reuse(config.ApiKey, options.Value.Deepgram.ApiKey));
        request.Content = new StreamContent(audio);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(mime);
        return request;
    }

    private HttpRequestMessage BuildGroq(Stream audio, string mime, string fileName, TranscriptionSettings s, string provider)
    {
        var config = provider == "GroqWhisper" ? options.Value.GroqWhisper : options.Value.Groq;
        var form = new MultipartFormDataContent();
        var content = new StreamContent(audio);
        content.Headers.ContentType = new MediaTypeHeaderValue(mime);
        form.Add(content, "file", Path.GetFileName(fileName));
        form.Add(new StringContent(config.Model), "model");
        form.Add(new StringContent("verbose_json"), "response_format");
        if (s.Languages.Length == 1)
            form.Add(new StringContent(s.Languages[0].Split('-')[0]), "language");
        if (s.Vocabulary.Length > 0 && !s.Timestamps)
            form.Add(new StringContent(string.Join(", ", s.Vocabulary)), "prompt");
        if (s.Timestamps) form.Add(new StringContent("word"), "timestamp_granularities[]");
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/audio/transcriptions")
        { Content = form };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ProviderCatalog.Reuse(config.ApiKey, options.Value.Groq.ApiKey));
        return request;
    }

    private static string? Offset(JsonElement word, string property) =>
        word.TryGetProperty(property, out var value)
            ? value.GetDouble().ToString("0.###", CultureInfo.InvariantCulture) + "s" : null;
}

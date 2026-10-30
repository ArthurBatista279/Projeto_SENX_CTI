namespace TranscribeTest;

public sealed record TranscriptionProvider(string Name, string Label, string Key, string Model,
    int MaxFileSizeMb, bool Diarization, bool Timestamps = true);

public static class ProviderCatalog
{
    public static TranscriptionProvider[] Get(GeminiOptions gemini, FallbackOptions o) =>
    [
        new("Gemini", "Gemini Transcribe", gemini.ApiKey, gemini.TranscribeModel, 2048, true),
        new("Deepgram", "Deepgram Nova-3", o.Deepgram.ApiKey, o.Deepgram.Model, o.Deepgram.MaxFileSizeMb, true),
        new("Groq", "Groq Whisper Turbo", o.Groq.ApiKey, o.Groq.Model, o.Groq.MaxFileSizeMb, false),
        new("NvidiaParakeet", "NVIDIA Parakeet multilíngue", o.Nvidia.ApiKey, "parakeet-1.1b-rnnt-multilingual-asr", o.Nvidia.MaxFileSizeMb, false),
        new("NvidiaWhisper", "NVIDIA Whisper Large V3", o.Nvidia.ApiKey, "whisper-large-v3", o.Nvidia.MaxFileSizeMb, false, false),
        new("DeepgramNova2", "Deepgram Nova-2", Reuse(o.DeepgramNova2.ApiKey, o.Deepgram.ApiKey), o.DeepgramNova2.Model, o.DeepgramNova2.MaxFileSizeMb, true),
        new("GroqWhisper", "Groq Whisper Large V3", Reuse(o.GroqWhisper.ApiKey, o.Groq.ApiKey), o.GroqWhisper.Model, o.GroqWhisper.MaxFileSizeMb, false)
    ];

    public static string Reuse(string? own, string original) => FallbackOptions.HasKey(own) ? own! : original;
}

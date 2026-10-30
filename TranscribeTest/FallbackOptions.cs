namespace TranscribeTest;

public sealed class FallbackOptions
{
    public double PrimaryTimeoutSeconds { get; set; } = 45;
    public double BackupTimeoutSeconds { get; set; } = 30;
    public double LiveConnectTimeoutSeconds { get; set; } = 10;
    public double LiveResponseTimeoutSeconds { get; set; } = 15;
    public double LiveRefreshSeconds { get; set; } = 8;
    public double QuotaCooldownSeconds { get; set; } = 60;
    public ProviderOptions Deepgram { get; set; } = new() { Model = "nova-3", MaxFileSizeMb = 300 };
    public ProviderOptions Groq { get; set; } = new() { Model = "whisper-large-v3-turbo", MaxFileSizeMb = 25 };
    public ProviderOptions DeepgramNova2 { get; set; } = new() { Model = "nova-2", MaxFileSizeMb = 300 };
    public ProviderOptions GroqWhisper { get; set; } = new() { Model = "whisper-large-v3", MaxFileSizeMb = 25 };
    public NvidiaOptions Nvidia { get; set; } = new();

    public static bool HasKey(string? key) =>
        !string.IsNullOrWhiteSpace(key) && !key.StartsWith("COLE_", StringComparison.OrdinalIgnoreCase);
}

public sealed class NvidiaOptions
{
    public string ApiKey { get; set; } = "";
    public string WhisperFunctionId { get; set; } = "b702f636-f60c-4a3d-a6f4-f3568c13bd7d";
    public string ParakeetFunctionId { get; set; } = "71203149-d3b7-4460-8231-1be2543a1fca";
    public int MaxFileSizeMb { get; set; } = 100;
    public int MaxAudioMinutes { get; set; } = 60;
}

public sealed class ProviderOptions
{
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "";
    public int MaxFileSizeMb { get; set; }
}

public sealed record TranscriptionSettings(string Mode, bool Diarization, bool Timestamps,
    string[] Languages, string[] Vocabulary);

public sealed class TranscriptionUnavailableException(string message) : Exception(message);

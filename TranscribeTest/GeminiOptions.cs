namespace TranscribeTest;

public sealed class GeminiOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string TranscribeModel { get; set; } = "gemini-3.5-transcribe";
    public string TranscribeLiveModel { get; set; } = "gemini-3.5-transcribe-live";
}

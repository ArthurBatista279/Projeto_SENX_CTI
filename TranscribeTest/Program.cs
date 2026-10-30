using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;
using TranscribeTest;

// =====================================================================
//  >>> SUA API KEY FICA EM: appsettings.json  ->  "Gemini": { "ApiKey": "..." }
//  Gere uma em https://aistudio.google.com/apikey
// =====================================================================

const string Url = "http://localhost:5080";

var builder = WebApplication.CreateBuilder(args);
var uploadLimits = new UploadLimits(builder.Configuration.GetValue("Uploads:MaxFileSizeMb", UploadLimits.MaximumLimitMb));
builder.Services.AddSingleton(uploadLimits);

builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection("Gemini"));
builder.Services.AddOptions<FallbackOptions>().Bind(builder.Configuration.GetSection("Fallback"))
    .Validate(o => o.PrimaryTimeoutSeconds > 0 && o.PrimaryTimeoutSeconds <= 3600
        && o.BackupTimeoutSeconds > 0 && o.BackupTimeoutSeconds <= 3600
        && o.LiveConnectTimeoutSeconds > 0 && o.LiveConnectTimeoutSeconds <= 120
        && o.LiveResponseTimeoutSeconds > 0 && o.LiveResponseTimeoutSeconds <= 600
        && o.LiveRefreshSeconds >= 1 && o.LiveRefreshSeconds <= 600
        && o.QuotaCooldownSeconds > 0 && o.QuotaCooldownSeconds <= 86400
        && o.Deepgram.MaxFileSizeMb > 0 && o.Groq.MaxFileSizeMb > 0
        && o.DeepgramNova2.MaxFileSizeMb > 0 && o.GroqWhisper.MaxFileSizeMb > 0
        && o.Nvidia.MaxFileSizeMb > 0 && o.Nvidia.MaxAudioMinutes > 0
        && Guid.TryParse(o.Nvidia.WhisperFunctionId, out _) && Guid.TryParse(o.Nvidia.ParakeetFunctionId, out _),
        "Fallback: configure tempos e limites positivos dentro dos limites documentados.")
    .ValidateOnStart();
builder.Services.AddHttpClient<GeminiTranscribeService>(c => c.Timeout = Timeout.InfiniteTimeSpan);
builder.Services.AddHttpClient<BackupTranscribeService>(c => c.Timeout = Timeout.InfiniteTimeSpan);
builder.Services.AddHttpClient<NvidiaTranscribeService>(c => c.Timeout = Timeout.InfiniteTimeSpan)
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { UseCookies = false });
builder.Services.AddTransient<TranscriptionRouter>();
builder.Services.AddSingleton<ProviderQuotaState>();
builder.Services.AddSingleton<RecordingStore>();
builder.Services.AddSingleton<GeminiTranscribeLiveBridge>();
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = uploadLimits.MaxFileSizeBytes);
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = uploadLimits.MaxRequestBodyBytes);
builder.Services.Configure<IISServerOptions>(o => o.MaxRequestBodySize = uploadLimits.MaxRequestBodyBytes);

var app = builder.Build();

var key = app.Services.GetRequiredService<IOptions<GeminiOptions>>().Value.ApiKey;
if (string.IsNullOrWhiteSpace(key) || key.StartsWith("COLE_SUA"))
{
    Console.ForegroundColor = ConsoleColor.Yellow;
    Console.WriteLine("\n[ATENÇÃO] API key não configurada. Edite o appsettings.json (Gemini:ApiKey).\n");
    Console.ResetColor();
}

app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
app.UseDefaultFiles();
app.UseStaticFiles();

// Apenas tempos e disponibilidade; as chaves permanecem no appsettings do servidor.
app.MapGet("/api/transcription-config", (IOptions<FallbackOptions> options, IOptions<GeminiOptions> gemini, UploadLimits limits, ProviderQuotaState quotas) =>
{
    var o = options.Value;
    var catalog = ProviderCatalog.Get(gemini.Value, o);
    return Results.Ok(new
    {
        maxFileSizeBytes = limits.MaxFileSizeBytes,
        maxFileSizeMb = limits.MaxFileSizeMb,
        backupAvailable = catalog.Any(p => p.Name != "Gemini" && FallbackOptions.HasKey(p.Key)),
        providers = catalog.Select(p => new { name = p.Name, label = p.Label, model = p.Model,
            configured = FallbackOptions.HasKey(p.Key), streaming = p.Name == "Gemini",
            available = quotas.Remaining(p.Name, p.Key) == TimeSpan.Zero,
            quotaRetryAfterSeconds = Math.Ceiling(quotas.Remaining(p.Name, p.Key).TotalSeconds),
            diarization = p.Diarization, timestamps = p.Timestamps }),
        o.LiveConnectTimeoutSeconds, o.LiveResponseTimeoutSeconds, o.LiveRefreshSeconds
    });
});

app.MapPost("/api/recordings", (RecordingStore store) => Results.Ok(store.Create()));
app.MapPut("/api/recordings/{id}", async (string id, IFormFile file, RecordingStore store, UploadLimits limits, CancellationToken ct) =>
{
    if (!limits.Accepts(file.Length))
        return Results.Json(new { detail = $"Envie um arquivo não vazio de até {limits.MaxFileSizeMb} MB." }, statusCode: file.Length == 0 ? 400 : 413);
    try { return Results.Ok(await store.SaveAsync(file, id, ct)); }
    catch (ArgumentException ex) { return Results.BadRequest(new { detail = ex.Message }); }
    catch (DirectoryNotFoundException) { return Results.NotFound(); }
}).DisableAntiforgery();
app.MapGet("/api/recordings/{id}/audio", (string id, RecordingStore store) =>
{
    try
    {
        var path = store.GetAudioPath(id);
        return Results.File(path, "application/octet-stream", Path.GetFileName(path), enableRangeProcessing: true);
    }
    catch (ArgumentException) { return Results.BadRequest(); }
    catch (IOException) { return Results.NotFound(); }
});

static string[] SplitCsv(string? s) =>
    string.IsNullOrWhiteSpace(s)
        ? []
        : s.Split([',', '\n', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

// ---------- Transcrição de arquivo ----------
app.MapPost("/api/transcribe", async (
    IFormFile file,
    TranscriptionRouter svc,
    RecordingStore store,
    UploadLimits limits,
    string? mode,
    bool? diarization,
    bool? timestamps,
    string? lang,
    string? vocab,
    bool? backupOnly,
    string? provider,
    string? recordingId,
    CancellationToken ct) =>
{
    SavedRecording? recording = null;
    try
    {
        if (file.Length == 0) return Results.BadRequest(new { detail = "O arquivo de áudio está vazio." });
        if (!limits.Accepts(file.Length))
            return Results.Json(new { detail = $"O arquivo excede o limite de {limits.MaxFileSizeMb} MB." }, statusCode: 413);
        recording = await store.SaveAsync(file, recordingId, ct);
        var settings = new TranscriptionSettings(mode == "verbatim" ? "verbatim" : "smart",
            diarization ?? false, timestamps ?? false, SplitCsv(lang), SplitCsv(vocab));
        var result = await svc.TranscribeAsync(file, settings, backupOnly ?? false, ct, provider);

        return Results.Ok(new { result.Text, result.Words, result.Raw, result.Provider, result.ProviderLabel, result.Model, result.Notices, recording });
    }
    catch (TranscriptionUnavailableException ex)
    {
        return Results.Json(new { detail = ex.Message, recording }, statusCode: 503);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { detail = ex.Message, recording });
    }
    catch (OperationCanceledException) when (ct.IsCancellationRequested)
    {
        return Results.StatusCode(499);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message, statusCode: 500);
    }
}).DisableAntiforgery();

// ---------- Transcrição ao vivo (WebSocket) ----------
app.Map("/ws/transcribe", async (HttpContext ctx, GeminiTranscribeLiveBridge bridge) =>
{
    if (!ctx.WebSockets.IsWebSocketRequest)
    {
        ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var q = ctx.Request.Query;
    var settings = new LiveSettings(
        LanguageCodes: SplitCsv(q["lang"]),
        Mode: string.Equals(q["mode"], "VERBATIM", StringComparison.OrdinalIgnoreCase) ? "VERBATIM" : "SMART",
        CustomVocabulary: SplitCsv(q["vocab"]));

    using var client = await ctx.WebSockets.AcceptWebSocketAsync();
    await bridge.RunAsync(client, settings, ctx.RequestAborted);
});

Console.WriteLine($"\nAbra no navegador: {Url}\n");
app.Run(Url);

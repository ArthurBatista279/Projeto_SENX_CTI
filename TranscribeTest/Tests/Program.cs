using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TranscribeTest;

// Teste externo opcional: somente quando chamado explicitamente com um WAV sintético.
if (args.Length is 2 or 3 && args[0] == "--probe-nvidia")
{
    var configuration = new ConfigurationBuilder().SetBasePath(Directory.GetCurrentDirectory())
        .AddJsonFile("appsettings.json").Build();
    var config = configuration.GetSection("Fallback").Get<FallbackOptions>()!;
    using var http = new HttpClient(new SocketsHttpHandler { UseCookies = false }) { Timeout = Timeout.InfiniteTimeSpan };
    var service = new NvidiaTranscribeService(http, Options.Create(config));
    foreach (var provider in new[] { "NvidiaWhisper", "NvidiaParakeet" })
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        await using var audio = File.OpenRead(args[1]);
        try
        {
            var result = await service.TranscribeAsync(provider, audio, args[1],
                new("smart", false, provider == "NvidiaParakeet", [args.Length == 3 ? args[2] : "en-US"], []), timeout.Token);
            Console.WriteLine($"{provider}: OK; palavras com tempos={result.Words.Count}; texto={result.Text}");
        }
        catch (Grpc.Core.RpcException ex) { Console.WriteLine($"{provider}: gRPC {ex.StatusCode}; {ex.Status.Detail.Replace(config.Nvidia.ApiKey, "[chave omitida]")}"); }
        catch (OperationCanceledException) { Console.WriteLine($"{provider}: timeout"); }
    }
    return;
}

var passed = 0;
async Task Check(string name, Func<Task> run)
{
    await run(); Console.WriteLine("PASS " + name); passed++;
}
void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
const string deepgramJson = """{"results":{"channels":[{"alternatives":[{"transcript":"Olá mundo","words":[{"word":"Olá","speaker":0,"start":0.1,"end":0.4}]}]}]}}""";
const string groqJson = """{"text":"Olá Groq","words":[{"word":"Olá","start":0.1,"end":0.4}]}""";
HttpResponseMessage Json(string json, HttpStatusCode code = HttpStatusCode.OK) => new(code) { Content = new StringContent(json) };
var settings = new TranscriptionSettings("smart", false, false, ["pt-BR"], []);
IFormFile Audio(byte[]? bytes = null) => new FormFile(new MemoryStream(bytes ?? [1, 2, 3, 4]), 0,
    bytes?.Length ?? 4, "file", "teste.mp3") { Headers = new HeaderDictionary(), ContentType = "audio/mpeg" };
FallbackOptions Config() => new()
{
    PrimaryTimeoutSeconds = .04, BackupTimeoutSeconds = 2,
    Deepgram = new() { ApiKey = "test-deepgram", Model = "nova-3", MaxFileSizeMb = 300 },
    Groq = new() { ApiKey = "test-groq", Model = "whisper-large-v3-turbo", MaxFileSizeMb = 25 }
};
TranscriptionRouter Router(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send,
    FallbackOptions? config = null, string key = "test-gemini")
{
    var http = new HttpClient(new Handler(send));
    var geminiOptions = Options.Create(new GeminiOptions { ApiKey = key });
    var fallbackOptions = Options.Create(config ?? Config());
    return new(new(http, geminiOptions), new(http, fallbackOptions), geminiOptions, fallbackOptions,
        NullLogger<TranscriptionRouter>.Instance);
}

await Check("quota Gemini aciona Deepgram e relê o áudio integral", async () =>
{
    var calls = new List<string>();
    var router = Router(async (request, ct) =>
    {
        calls.Add(request.RequestUri!.Host);
        if (request.RequestUri.Host.Contains("google")) return Json("quota", HttpStatusCode.TooManyRequests);
        Assert((await request.Content!.ReadAsByteArrayAsync(ct)).SequenceEqual(new byte[] { 1, 2, 3, 4 }), "Áudio alterado");
        return Json(deepgramJson);
    });
    var result = await router.TranscribeAsync(Audio(), settings, false, default);
    Assert(result.Provider == "Deepgram" && result.Text == "Olá mundo" && calls.Count == 2, "Fallback incorreto");
    Assert(result.Notices.Any(n => n.Contains("429")), "Motivo não informado");
});
await Check("timeout cancela Gemini e usa reserva", async () =>
{
    var canceled = false;
    var router = Router(async (request, ct) =>
    {
        if (request.RequestUri!.Host.Contains("google"))
        {
            try { await Task.Delay(5000, ct); } catch (OperationCanceledException) { canceled = true; throw; }
        }
        return Json(deepgramJson);
    });
    var result = await router.TranscribeAsync(Audio(), settings, false, default);
    Assert(canceled && result.Provider == "Deepgram", "Timeout não acionou reserva");
});
await Check("Deepgram 503 aciona Groq com timestamps e idioma normalizado", async () =>
{
    var router = Router(async (request, ct) =>
    {
        if (request.RequestUri!.Host.Contains("deepgram")) return Json("error", HttpStatusCode.ServiceUnavailable);
        var form = await request.Content!.ReadAsStringAsync(ct);
        Assert(form.Contains("timestamp_granularities[]") && form.Contains("\r\npt\r\n"), "Configuração Groq ausente");
        return Json(groqJson);
    });
    var result = await router.TranscribeAsync(Audio(), settings with { Timestamps = true }, true, default);
    Assert(result.Provider == "Groq" && result.Words[0].Start == "0.1s", "Parsing Groq incorreto");
});
await Check("escolha manual prioriza Groq", async () =>
{
    var router = Router((request, ct) =>
    {
        Assert(request.RequestUri!.Host == "api.groq.com", "Preferência ignorada");
        return Task.FromResult(Json(groqJson));
    });
    Assert((await router.TranscribeAsync(Audio(), settings, false, default, "Groq")).Provider == "Groq", "IA incorreta");
});
await Check("cancelamento do usuário não chama reservas", async () =>
{
    var count = 0;
    using var cts = new CancellationTokenSource(); cts.Cancel();
    var router = Router((r, ct) => { count++; return Task.FromResult(Json(deepgramJson)); });
    try { await router.TranscribeAsync(Audio(), settings, false, cts.Token); throw new Exception("Não cancelou"); }
    catch (OperationCanceledException) { Assert(count == 0, "Chamou provedor após cancelamento"); }
});
await Check("diarização não é descartada silenciosamente no Groq", async () =>
{
    var config = Config(); config.Deepgram.ApiKey = "COLE_SUA_CHAVE";
    var router = Router((r, ct) => throw new Exception("Groq não deveria ser chamado"), config);
    try { await router.TranscribeAsync(Audio(), settings with { Diarization = true }, true, default); throw new Exception("Deveria falhar"); }
    catch (TranscriptionUnavailableException ex) { Assert(ex.Message.Contains("diarização"), "Motivo ausente"); }
});
await Check("falha em todas as reservas retorna erro agregado", async () =>
{
    var router = Router((r, ct) => Task.FromResult(Json("erro", HttpStatusCode.TooManyRequests)));
    try { await router.TranscribeAsync(Audio(), settings, true, default); throw new Exception("Deveria falhar"); }
    catch (TranscriptionUnavailableException ex) { Assert(ex.Message.Contains("Deepgram") && ex.Message.Contains("Groq"), "Erro incompleto"); }
});
await Check("gravação preserva bytes e extensão, atualiza sessão e rejeita caminhos externos", async () =>
{
    var testRoot = Path.Combine(Path.GetTempPath(), "TranscribeTest-checks-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(testRoot);
    try
    {
        var store = new RecordingStore(new EnvironmentStub { ContentRootPath = testRoot }, new ConfigurationBuilder().Build());
        var saved = await store.SaveAsync(Audio(), null, default);
        var path = store.GetAudioPath(saved.Id);
        Assert(path.EndsWith("audio.mp3") && File.ReadAllBytes(path).SequenceEqual(new byte[] { 1, 2, 3, 4 }), "Arquivo diferente");
        await store.SaveAsync(Audio([5, 6]), saved.Id, default);
        Assert(File.ReadAllBytes(path).SequenceEqual(new byte[] { 5, 6 }), "Atualização não persistiu");
        try { store.GetFolder("../../outside"); throw new Exception("Aceitou caminho externo"); }
        catch (ArgumentException) { }
    }
    finally { Directory.Delete(testRoot, recursive: true); }
});
await Check("catálogo reaproveita chaves e respeita chave própria", () =>
{
    var config = Config(); config.Nvidia.ApiKey = "test-nvidia";
    var catalog = ProviderCatalog.Get(new GeminiOptions(), config);
    Assert(catalog.Length == 7, "Modelos faltando");
    Assert(catalog.Single(p => p.Name == "GroqWhisper").Key == config.Groq.ApiKey, "Chave Groq não reutilizada");
    Assert(catalog.Single(p => p.Name == "DeepgramNova2").Key == config.Deepgram.ApiKey, "Chave Deepgram não reutilizada");
    Assert(catalog.Where(p => p.Name.StartsWith("Nvidia")).All(p => p.Key == "test-nvidia"), "Chave NVIDIA incorreta");
    config.GroqWhisper.ApiKey = "another-test-key";
    Assert(ProviderCatalog.Get(new(), config).Single(p => p.Name == "GroqWhisper").Key == "another-test-key", "Override ignorado");
    return Task.CompletedTask;
});
await Check("Nova-2 e Whisper V3 enviam modelo e chave reaproveitada corretos", async () =>
{
    var router = Router(async (request, ct) =>
    {
        if (request.RequestUri!.Host == "api.deepgram.com")
        {
            Assert(request.RequestUri.Query.Contains("model=nova-2") && request.RequestUri.Query.Contains("keywords=teste"), "Parâmetros Nova-2 incorretos");
            Assert(request.Headers.Authorization!.Parameter == "test-deepgram", "Chave Deepgram incorreta");
            return Json(deepgramJson);
        }
        var form = await request.Content!.ReadAsStringAsync(ct);
        Assert(form.Contains("\r\nwhisper-large-v3\r\n"), "Modelo Whisper incorreto");
        Assert(request.Headers.Authorization!.Parameter == "test-groq", "Chave Groq incorreta");
        return Json(groqJson);
    });
    Assert((await router.TranscribeAsync(Audio(), settings with { Vocabulary = ["teste"] }, false, default, "DeepgramNova2")).Provider == "DeepgramNova2", "Seleção Nova-2 ignorada");
    Assert((await router.TranscribeAsync(Audio(), settings, false, default, "GroqWhisper")).Provider == "GroqWhisper", "Seleção Whisper ignorada");
});
byte[] Wav()
{
    using var output = new MemoryStream();
    using (var writer = new BinaryWriter(output, Encoding.ASCII, leaveOpen: true))
    {
        writer.Write(Encoding.ASCII.GetBytes("RIFF")); writer.Write(32036);
        writer.Write(Encoding.ASCII.GetBytes("WAVEfmt ")); writer.Write(16); writer.Write((short)1);
        writer.Write((short)1); writer.Write(16000); writer.Write(32000); writer.Write((short)2); writer.Write((short)16);
        writer.Write(Encoding.ASCII.GetBytes("data")); writer.Write(32000); writer.Write(new byte[32000]);
    }
    return output.ToArray();
}
await Check("NVIDIA converte WAV e usa contrato gRPC e function-id oficiais", async () =>
{
    var config = Config(); config.Nvidia.ApiKey = "test-nvidia";
    var http = new HttpClient(new Handler(async (request, ct) =>
    {
        Assert(request.RequestUri!.AbsolutePath == "/nvidia.riva.asr.RivaSpeechRecognition/Recognize", "Método gRPC incorreto");
        Assert(request.Headers.GetValues("function-id").Single() == config.Nvidia.WhisperFunctionId, "Function-id incorreto");
        var body = await request.Content!.ReadAsByteArrayAsync(ct);
        var input = Nvidia.Riva.Asr.RecognizeRequest.Parser.ParseFrom(body.AsSpan(5).ToArray());
        Assert(input.Audio.Length == 32000 && input.Config.LanguageCode == "pt" && input.Config.SampleRateHertz == 16000, "Áudio/configuração incorretos");
        var message = new Nvidia.Riva.Asr.RecognizeResponse();
        var result = new Nvidia.Riva.Asr.SpeechRecognitionResult();
        result.Alternatives.Add(new Nvidia.Riva.Asr.SpeechRecognitionAlternative { Transcript = "teste NVIDIA" });
        message.Results.Add(result);
        var payload = Google.Protobuf.MessageExtensions.ToByteArray(message);
        var frame = new byte[5 + payload.Length];
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(frame.AsSpan(1, 4), payload.Length);
        payload.CopyTo(frame, 5);
        var response = new HttpResponseMessage(HttpStatusCode.OK) { Version = new Version(2, 0), Content = new ByteArrayContent(frame) };
        response.Content.Headers.ContentType = new("application/grpc");
        response.TrailingHeaders.Add("grpc-status", "0");
        return response;
    }));
    var service = new NvidiaTranscribeService(http, Options.Create(config));
    var result = await service.TranscribeAsync("NvidiaWhisper", new MemoryStream(Wav()), "teste.wav", settings, default);
    Assert(result.Text == "teste NVIDIA", "Resposta NVIDIA não interpretada");
});
await Check("conversão MP3 NVIDIA preserva áudio em PCM mono de 16 kHz", async () =>
{
    if (!OperatingSystem.IsWindows()) return;
    var mp3 = Path.Combine(Path.GetTempPath(), "TranscribeTest-mp3-check-" + Guid.NewGuid().ToString("N") + ".mp3");
    try
    {
        using (var reader = new NAudio.Wave.WaveFileReader(new MemoryStream(Wav())))
            NAudio.Wave.MediaFoundationEncoder.EncodeToMp3(reader, mp3);
        await using var input = File.OpenRead(mp3);
        var decoded = await NvidiaTranscribeService.DecodeAsync(input, mp3, 1, default);
        Assert(decoded.Length >= 30000 && decoded.Length < 40000, "Duração/taxa do PCM incorreta");
    }
    finally { if (File.Exists(mp3)) File.Delete(mp3); }
});
await Check("NVIDIA indisponível aciona outra empresa", async () =>
{
    var config = Config(); config.Nvidia.ApiKey = "test-nvidia";
    var failedNvidia = new HttpClient(new Handler((request, ct) =>
    {
        var response = new HttpResponseMessage(HttpStatusCode.OK) { Version = new Version(2, 0), Content = new ByteArrayContent([]) };
        response.Content.Headers.ContentType = new("application/grpc");
        response.Headers.Add("grpc-status", "8");
        return Task.FromResult(response);
    }));
    var ordinary = new HttpClient(new Handler((r, ct) => Task.FromResult(Json(deepgramJson))));
    var go = Options.Create(new GeminiOptions()); var fo = Options.Create(config);
    var router = new TranscriptionRouter(new(ordinary, go), new(ordinary, fo), go, fo,
        NullLogger<TranscriptionRouter>.Instance, new NvidiaTranscribeService(failedNvidia, fo));
    var bytes = Wav();
    var file = new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "test.wav") { Headers = new HeaderDictionary(), ContentType = "audio/wav" };
    var result = await router.TranscribeAsync(file, settings, true, default, "NvidiaWhisper");
    Assert(result.Provider == "Deepgram" && result.Notices.Any(n => n.Contains("ResourceExhausted")), "Fallback NVIDIA falhou");
});
await Check("upload aceita até 2 GB e valida configuração entre 500 e 2048 MB", () =>
{
    var limits = new UploadLimits();
    Assert(limits.Accepts(500L * 1024 * 1024), "500 MB recusados");
    Assert(limits.Accepts(2L * 1024 * 1024 * 1024), "2 GB recusados");
    Assert(!limits.Accepts(2L * 1024 * 1024 * 1024 + 1), "Excedente aceito");
    Assert(limits.Accepts(1024), "Arquivos pequenos devem continuar aceitos");
    Assert(limits.MaxRequestBodyBytes > limits.MaxFileSizeBytes, "Sem margem multipart");
    Assert(new UploadLimits(500).Accepts(500L * 1024 * 1024), "Limite configurável incorreto");
    foreach (var invalid in new[] { 499, 2049 })
    {
        try { _ = new UploadLimits(invalid); throw new Exception("Configuração fora do intervalo aceita"); }
        catch (ArgumentOutOfRangeException) { }
    }
    return Task.CompletedTask;
});
await Check("Gemini envia stream de 2 GB sem carregar arquivo em memória", async () =>
{
    const long length = 2L * 1024 * 1024 * 1024;
    var calls = 0;
    var http = new HttpClient(new Handler((request, ct) =>
    {
        calls++;
        if (calls == 1)
        {
            Assert(request.Headers.GetValues("X-Goog-Upload-Header-Content-Length").Single() == length.ToString(), "Tamanho de 64 bits incorreto");
            var response = Json("{}");
            response.Headers.Add("X-Goog-Upload-URL", "https://generativelanguage.googleapis.com/mock-upload");
            return Task.FromResult(response);
        }
        if (calls == 2)
        {
            Assert(request.Content is StreamContent && request.Content.Headers.ContentLength == length, "Upload deve usar stream e long");
            return Task.FromResult(Json("""{"file":{"uri":"mock://audio","mimeType":"audio/mpeg"}}"""));
        }
        return Task.FromResult(Json("""{"output_text":"teste grande"}"""));
    }));
    var service = new GeminiTranscribeService(http, Options.Create(new GeminiOptions { ApiKey = "test-key" }));
    var result = await service.TranscribeAsync(new LengthOnlyStream(length), "audio/mpeg", "smart", false, false, [], [], default);
    Assert(result.Text == "teste grande" && calls == 3, "Fluxo Gemini incompleto");
});
await Check("quota respeita Retry-After entre requisições, pula chave compartilhada e expira", async () =>
{
    var clock = new TestClock(); var quotas = new ProviderQuotaState(clock);
    var dgCalls = 0; var groqCalls = 0;
    var http = new HttpClient(new Handler((request, ct) =>
    {
        if (request.RequestUri!.Host == "api.deepgram.com")
        {
            dgCalls++;
            if (dgCalls == 1)
            {
                var limited = Json("quota", HttpStatusCode.TooManyRequests);
                limited.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(120));
                return Task.FromResult(limited);
            }
            return Task.FromResult(Json(deepgramJson));
        }
        groqCalls++; return Task.FromResult(Json(groqJson));
    }));
    var go = Options.Create(new GeminiOptions()); var fo = Options.Create(Config());
    TranscriptionRouter NewRouter() => new(new(http, go), new(http, fo), go, fo, NullLogger<TranscriptionRouter>.Instance, quotas: quotas);
    Assert((await NewRouter().TranscribeAsync(Audio(), settings, true, default, "Deepgram")).Provider == "Groq", "Não trocou IA");
    Assert((await NewRouter().TranscribeAsync(Audio(), settings, true, default, "DeepgramNova2")).Provider == "Groq", "Não compartilhou pausa");
    Assert(dgCalls == 1 && groqCalls == 2, "Repetiu chamada bloqueada");
    Assert(quotas.Remaining("Deepgram", "outra-chave") == TimeSpan.Zero, "Bloqueou outra chave");
    clock.Now += TimeSpan.FromSeconds(121);
    Assert((await NewRouter().TranscribeAsync(Audio(), settings, true, default, "Deepgram")).Provider == "Deepgram", "Não liberou após Retry-After");
});
await Check("erro de cota estruturado e resposta incompleta acionam fallback sem confundir texto", () =>
{
    try
    {
        ProviderFailure.Check(Json("{}", HttpStatusCode.Forbidden), """{"error":{"status":"RESOURCE_EXHAUSTED","details":[{"retryDelay":"90s"}]}}""");
        throw new Exception("Cota não detectada");
    }
    catch (ProviderQuotaException ex) { Assert(ex.RetryAfter == TimeSpan.FromSeconds(90), "RetryInfo ignorado"); }
    try
    {
        ProviderFailure.Check(Json("{}"), """{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"output_text":"parcial"}""");
        throw new Exception("Resposta truncada foi aceita");
    }
    catch (InvalidDataException) { }
    ProviderFailure.Check(Json("{}"), """{"text":"O palestrante disse quota e rate limit."}""");
    return Task.CompletedTask;
});
Console.WriteLine($"{passed} verificações passaram.");

sealed class Handler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => send(request, cancellationToken);
}
sealed class EnvironmentStub : IWebHostEnvironment
{
    public string ApplicationName { get; set; } = "Checks";
    public string EnvironmentName { get; set; } = "Development";
    public string ContentRootPath { get; set; } = "";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public string WebRootPath { get; set; } = "";
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
}

sealed class LengthOnlyStream(long length) : Stream
{
    public override bool CanRead => true;
    public override bool CanSeek => true;
    public override bool CanWrite => false;
    public override long Length => length;
    public override long Position { get; set; }
    public override int Read(byte[] buffer, int offset, int count) => throw new Exception("O serviço tentou materializar o arquivo antes do upload");
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    public override void Flush() { }
}

sealed class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => Now;
}

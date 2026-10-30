using System.Globalization;
using System.Text.Json;
using Google.Protobuf;
using Grpc.Core;
using Grpc.Net.Client;
using Microsoft.Extensions.Options;
using NAudio;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using Nvidia.Riva;
using Nvidia.Riva.Asr;

namespace TranscribeTest;

public sealed class NvidiaTranscribeService(HttpClient http, IOptions<FallbackOptions> options)
{
    public async Task<TranscriptionResult> TranscribeAsync(string provider, Stream audio, string fileName,
        TranscriptionSettings settings, CancellationToken ct)
    {
        var config = options.Value.Nvidia;
        var pcm = await DecodeAsync(audio, fileName, config.MaxAudioMinutes, ct);
        using var channel = GrpcChannel.ForAddress("https://grpc.nvcf.nvidia.com", new GrpcChannelOptions
        {
            HttpClient = http, MaxReceiveMessageSize = 32 * 1024 * 1024, MaxSendMessageSize = 4 * 1024 * 1024
        });
        var client = new RivaSpeechRecognition.RivaSpeechRecognitionClient(channel);
        var whisper = provider == "NvidiaWhisper";
        var headers = new Metadata
        {
            { "authorization", "Bearer " + config.ApiKey },
            { "function-id", whisper ? config.WhisperFunctionId : config.ParakeetFunctionId }
        };
        var language = settings.Languages.Length == 1 ? settings.Languages[0] : "multi";
        if (whisper && language != "multi") language = language.Split('-')[0];
        var recognition = new RecognitionConfig
        {
            Encoding = AudioEncoding.LinearPcm, SampleRateHertz = 16000, AudioChannelCount = 1,
            LanguageCode = language, MaxAlternatives = 1, EnableAutomaticPunctuation = true,
            EnableWordTimeOffsets = settings.Timestamps && !whisper,
            VerbatimTranscripts = settings.Mode == "verbatim"
        };
        if (!whisper && settings.Vocabulary.Length > 0)
        {
            var context = new SpeechContext { Boost = 10 };
            context.Phrases.Add(settings.Vocabulary);
            recognition.SpeechContexts.Add(context);
        }
        var texts = new List<string>();
        var words = new List<WordInfo>();
        var raw = new List<JsonElement>();
        if (whisper)
        {
            // Requisições curtas mantêm cada mensagem abaixo de 4 MiB; ordem e offsets são preservados.
            const int chunkBytes = 30 * 16000 * 2;
            for (var offset = 0; offset < pcm.Length; offset += chunkBytes)
            {
                ct.ThrowIfCancellationRequested();
                var response = await client.RecognizeAsync(new RecognizeRequest
                {
                    Config = recognition,
                    Audio = ByteString.CopyFrom(pcm, offset, Math.Min(chunkBytes, pcm.Length - offset))
                }, headers, cancellationToken: ct);
                raw.Add(JsonSerializer.Deserialize<JsonElement>(JsonFormatter.Default.Format(response)));
                foreach (var result in response.Results)
                    if (result.Alternatives.Count > 0) texts.Add(result.Alternatives[0].Transcript);
            }
        }
        else
        {
            using var duplexCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            using var call = client.StreamingRecognize(headers, cancellationToken: duplexCts.Token);
            await call.RequestStream.WriteAsync(new StreamingRecognizeRequest
            {
                StreamingConfig = new StreamingRecognitionConfig { Config = recognition, InterimResults = false }
            }, ct);
            // Ler e escrever simultaneamente evita travamento por controle de fluxo HTTP/2.
            async Task SendAsync()
            {
                try
                {
                    for (var offset = 0; offset < pcm.Length; offset += 32000)
                        await call.RequestStream.WriteAsync(new StreamingRecognizeRequest
                        {
                            AudioContent = ByteString.CopyFrom(pcm, offset, Math.Min(32000, pcm.Length - offset))
                        }, duplexCts.Token);
                    await call.RequestStream.CompleteAsync();
                }
                catch { duplexCts.Cancel(); throw; }
            }
            var send = SendAsync();
            try
            {
                await foreach (var response in call.ResponseStream.ReadAllAsync(duplexCts.Token))
                {
                    raw.Add(JsonSerializer.Deserialize<JsonElement>(JsonFormatter.Default.Format(response)));
                    foreach (var result in response.Results.Where(r => r.IsFinal && r.Alternatives.Count > 0))
                    {
                        var alternative = result.Alternatives[0];
                        texts.Add(alternative.Transcript);
                        if (settings.Timestamps)
                            words.AddRange(alternative.Words.Select(w => new WordInfo(w.Word, null,
                                Seconds(w.StartTime), Seconds(w.EndTime))));
                    }
                }
                await send;
            }
            finally
            {
                duplexCts.Cancel();
                try { await send; } catch when (duplexCts.IsCancellationRequested) { }
            }
        }
        return new TranscriptionResult(string.Join(" ", texts.Where(t => !string.IsNullOrWhiteSpace(t))), words,
            JsonSerializer.Serialize(raw)) { Provider = provider };
    }

    public static async Task<byte[]> DecodeAsync(Stream audio, string fileName, int maxMinutes, CancellationToken ct)
    {
        // O original já foi salvo pelo RecordingStore; somente a cópia temporária é convertida.
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (extension is not (".wav" or ".mp3" or ".m4a" or ".aac" or ".wma" or ".mp4"))
            throw new InvalidDataException("Conversão NVIDIA: formato não suportado pelo decodificador local.");
        var temp = Path.Combine(Path.GetTempPath(), "TranscribeTest-nvidia-" + Guid.NewGuid().ToString("N") + extension);
        try
        {
            await using (var output = File.Create(temp)) await audio.CopyToAsync(output, ct);
            if (!OperatingSystem.IsWindows() && extension != ".wav")
                throw new InvalidDataException("A conversão de áudio comprimido para NVIDIA exige Windows; use WAV.");
            using var reader = new AudioFileReader(temp);
            ISampleProvider samples = reader;
            if (samples.WaveFormat.Channels == 2) samples = new StereoToMonoSampleProvider(samples);
            if (samples.WaveFormat.Channels != 1) throw new InvalidDataException("Áudio NVIDIA deve ser mono ou estéreo.");
            if (samples.WaveFormat.SampleRate != 16000) samples = new WdlResamplingSampleProvider(samples, 16000);
            var pcm = new SampleToWaveProvider16(samples);
            using var result = new MemoryStream();
            var buffer = new byte[32000];
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var count = pcm.Read(buffer, 0, buffer.Length);
                if (count == 0) break;
                if (result.Length + count > maxMinutes * 60L * 32000)
                    throw new InvalidDataException("Áudio excede a duração configurada para NVIDIA.");
                result.Write(buffer, 0, count);
            }
            if (result.Length == 0) throw new InvalidDataException("Áudio sem amostras.");
            return result.ToArray();
        }
        catch (Exception ex) when (ex is System.Runtime.InteropServices.COMException or FormatException or MmException)
        { throw new InvalidDataException("Não foi possível converter este áudio para NVIDIA. Tente WAV ou MP3.", ex); }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }

    private static string Seconds(int milliseconds) => (milliseconds / 1000d).ToString("0.###", CultureInfo.InvariantCulture) + "s";
}

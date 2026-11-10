using System.Text.Json;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SenxCti.Api.Database;
using SenxCti.Api.Services.Ai;
using SenxCti.Api.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using SenxCti.Api.Services.Audio;

internal static class AiServiceChecks
{
    public static async Task<int> Run()
    {
        int passed = 0, failed = 0;
        void Check(bool ok, string label)
        {
            if (ok) passed++;
            else { failed++; Console.WriteLine("FAIL AI: " + label); }
        }
        var criterion = Guid.NewGuid();
        var second = Guid.NewGuid();
        string Payload(int score = 80) => JsonSerializer.Serialize(new {
            transcricaoTexto = "Cliente pede ajuda. Atendente orienta e confirma resolução.",
            resumoTexto = "Acesso recuperado.", cancelamento = false, oportunidade = true,
            problemaNecessidade = "Dificuldade de acesso", compromissos = "Retorno amanhã",
            resolucaoEncaminhamento = "Acesso recuperado",
            resultados = new[] { new { idCriterio = criterion, score, justificativa = "Orientação clara" },
                new { idCriterio = second, score = 90, justificativa = "Resolução confirmada" } }
        });
        var result = AiAnalysisService.Parse(Payload(), "teste", [criterion, second]);
        Check(result.ScoreGeral == 85 && result.Resultados.Count == 2 && !result.Simulada, "média dos critérios e origem");
        var withoutCriteria = System.Text.Json.Nodes.JsonNode.Parse(Payload())!;
        withoutCriteria["resultados"] = new System.Text.Json.Nodes.JsonArray();
        var transcriptOnly = AiAnalysisService.Parse(withoutCriteria.ToJsonString(), "teste", []);
        Check(transcriptOnly.Resultados.Count == 0 && transcriptOnly.ModeloVersao.EndsWith("/sem-criterios") &&
            transcriptOnly.TranscricaoTexto.Contains("Cliente") && !transcriptOnly.Simulada,
            "sem critérios preserva transcrição real e identifica ausência de avaliação");
        try { AiAnalysisService.Parse(Payload(), "teste", []); Check(false, "critérios inventados recusados"); }
        catch (JsonException) { Check(true, "critérios inventados recusados"); }
        try { AiAnalysisService.Parse(withoutCriteria.ToJsonString(), "teste", [criterion]); Check(false, "critério ativo omitido recusado"); }
        catch (JsonException) { Check(true, "critério ativo omitido recusado"); }
        var overlong = System.Text.Json.Nodes.JsonNode.Parse(Payload())!;
        overlong["compromissos"] = new string('a', 256);
        foreach (var payload in new[] { Payload(101), Payload(-1), "{}",
            Payload().Replace(criterion.ToString(), Guid.NewGuid().ToString()),
            Payload().Replace(second.ToString(), criterion.ToString()),
            overlong.ToJsonString() })
        {
            try { AiAnalysisService.Parse(payload, "teste", [criterion, second]); Check(false, "JSON inválido rejeitado"); }
            catch (Exception e) when (e is JsonException or KeyNotFoundException) { Check(true, "JSON inválido rejeitado"); }
        }
        var path = Path.Combine(Path.GetTempPath(), "senx-ai-check-" + Guid.NewGuid().ToString("N") + ".wav");
        try
        {
            // PCM fixture with a known length, independent of database and AI providers.
            using (var wav = new BinaryWriter(File.Create(path)))
            {
                wav.Write("RIFF"u8); wav.Write(32036); wav.Write("WAVEfmt "u8);
                wav.Write(16); wav.Write((short)1); wav.Write((short)1);
                wav.Write(16000); wav.Write(32000); wav.Write((short)2); wav.Write((short)16);
                wav.Write("data"u8); wav.Write(32000); wav.Write(new byte[32000]);
            }
            Check(AudioMetadata.ReadDuration(path) == TimeSpan.FromSeconds(1), "duração WAV extraída do arquivo");
            await File.WriteAllBytesAsync(path, "RIFF0000WAVE"u8.ToArray());
            try { AudioMetadata.ReadDuration(path); Check(false, "áudio truncado recusado"); }
            catch (Exception e) when (e is TagLib.CorruptFileException or TagLib.UnsupportedFormatException or InvalidDataException) { Check(true, "áudio truncado recusado"); }
            var configuration = new ConfigurationBuilder().AddInMemoryCollection().Build();
            await using var database = new DatabaseConnection(configuration);
            using var http = new HttpClient(new RejectNetwork());
            var service = new AiAnalysisService(http, configuration, database, NullLogger<AiAnalysisService>.Instance);
            try { await service.ProcessAudioAsync(path, CancellationToken.None); Check(false, "sem chave não simula sucesso"); }
            catch (AiProcessingException e) { Check(e.Message.Contains("GEMINI_API_KEY"), "sem chave informa configuração necessária"); }
            configuration["Ai:AllowSimulation"] = "true";
            var offline = await service.ProcessAudioAsync(path, CancellationToken.None);
            Check(offline.Simulada && offline.ModeloVersao.Contains("simulado") &&
                offline.TranscricaoTexto.Contains("áudio não transcrito") && offline.StatusProcessamento, "offline explicitamente simulado sem rede/banco");
            using var canceled = new CancellationTokenSource();
            canceled.Cancel();
            try { await service.ProcessAudioAsync(path, canceled.Token); Check(false, "cancelamento preservado"); }
            catch (OperationCanceledException) { Check(true, "cancelamento preservado"); }
            try { await service.ProcessAudioAsync(path + ".missing", CancellationToken.None); Check(false, "arquivo ausente"); }
            catch (AiProcessingException) { Check(true, "arquivo ausente"); }
        }
        finally { if (File.Exists(path)) File.Delete(path); }
        var account = new UserAccount(Guid.NewGuid(), "Teste", "teste@example.invalid", "Teste", "Administrador", Guid.NewGuid(), "QA");
        var password = Guid.NewGuid().ToString("N");
        var hasher = new CompatiblePasswordHasher(Options.Create(new PasswordHasherOptions { IterationCount = 210000 }));
        var bcrypt = BCrypt.Net.BCrypt.HashPassword(password, 12);
        Check(hasher.VerifyHashedPassword(account, bcrypt, password) == PasswordVerificationResult.Success, "seed BCrypt aceito");
        Check(hasher.VerifyHashedPassword(account, bcrypt, password + "errada") == PasswordVerificationResult.Failed, "senha BCrypt incorreta recusada");
        Check(hasher.VerifyHashedPassword(account, "$2invalid", password) == PasswordVerificationResult.Failed, "hash BCrypt malformado recusado");
        var identity = hasher.HashPassword(account, password);
        Check(hasher.VerifyHashedPassword(account, identity, password) != PasswordVerificationResult.Failed, "hash Identity existente preservado");
        Check(hasher.VerifyHashedPassword(account, identity, password + "errada") == PasswordVerificationResult.Failed, "senha Identity incorreta recusada");
        if (Environment.GetEnvironmentVariable("SENX_TEST_DB_CONNECTION") is { Length: > 0 } connectionString)
            failed += await RunHttp(connectionString);
        Console.WriteLine($"AI service: {passed} verificações passaram; {failed} falharam (sem chamadas externas).");
        return failed;
    }

    private static async Task<int> RunHttp(string connectionString)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["SENX_DB_CONNECTION"] = connectionString, ["Gemini:ApiKey"] = "qa-key-never-network",
            ["Gemini:AnalysisModel"] = "qa-primary", ["Gemini:FallbackAnalysisModel"] = "qa-backup"
        }).Build();
        await using var database = new DatabaseConnection(configuration);
        var criteria = new List<Guid>();
        await using (var db = await database.OpenAsync(default))
        await using (var command = new Npgsql.NpgsqlCommand("""SELECT "IdCriterio" FROM public."Criterio" WHERE "Ativo" ORDER BY "IdCriterio" LIMIT 100""", db))
        await using (var reader = await command.ExecuteReaderAsync())
            while (await reader.ReadAsync()) criteria.Add(reader.GetGuid(0));
        if (criteria.Count == 0) throw new InvalidOperationException("Teste HTTP exige critérios ativos no banco isolado.");
        var payload = JsonSerializer.Serialize(new {
            transcricaoTexto = "Transcrição controlada do teste HTTP.", resumoTexto = "Resumo controlado.",
            cancelamento = false, oportunidade = false, problemaNecessidade = "Teste", compromissos = "Nenhum",
            resolucaoEncaminhamento = "Teste", resultados = criteria.Select(id => new { idCriterio = id, score = 80, justificativa = "Evidência controlada" })
        });
        var path = Path.Combine(Path.GetTempPath(), "senx-ai-http-" + Guid.NewGuid().ToString("N") + ".wav");
        try
        {
            await File.WriteAllBytesAsync(path, "RIFF0000WAVE"u8.ToArray());
            using var handler = new GeminiFixture(payload);
            using var http = new HttpClient(handler);
            var service = new AiAnalysisService(http, configuration, database, NullLogger<AiAnalysisService>.Instance);
            var result = await service.ProcessAudioAsync(path, default);
            if (handler.Requests != 2 || result.ScoreGeral != 80 || result.ModeloVersao != "Gemini/qa-backup" || result.Simulada)
                throw new InvalidOperationException("Fallback Gemini não preservou o contrato real do adaptador.");
            handler.AlwaysFail = true;
            try { await service.ProcessAudioAsync(path, default); throw new InvalidOperationException("Falha remota foi ocultada."); }
            catch (AiProcessingException) { }
            var groqConfig = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                ["SENX_DB_CONNECTION"] = connectionString, ["Fallback:Groq:ApiKey"] = "qa-key-never-network"
            }).Build();
            using var groqHandler = new GroqFixture(payload);
            using var groqHttp = new HttpClient(groqHandler);
            var groq = new AiAnalysisService(groqHttp, groqConfig, database, NullLogger<AiAnalysisService>.Instance);
            var groqResult = await groq.ProcessAudioAsync(path, default);
            if (groqHandler.Requests != 2 || groqResult.TranscricaoTexto != "Transcrição fiel do ASR." || groqResult.Simulada || !groqResult.ModeloVersao.StartsWith("Groq/"))
                throw new InvalidOperationException("Contrato do adaptador Groq inválido.");
            Console.WriteLine("AI HTTP: Gemini fallback 429/JSON, Groq multipart ASR + análise, critérios e falha controlada PASS (HTTP interceptado; sem API externa).");
            return 0;
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }

    private sealed class GroqFixture(string payload) : HttpMessageHandler
    {
        public int Requests { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests++;
            if (request.RequestUri?.Host != "api.groq.com" || request.Headers.Authorization?.Scheme != "Bearer")
                throw new InvalidOperationException("Host/autorização Groq inválidos.");
            if (request.RequestUri.AbsolutePath.EndsWith("/audio/transcriptions"))
            {
                if (request.Content is not MultipartFormDataContent) throw new InvalidOperationException("Groq requer multipart.");
                return new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = JsonContent.Create(new { text = "Transcrição fiel do ASR." }) };
            }
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            if (body.RootElement.GetProperty("messages")[1].GetProperty("content").GetString() != "Transcrição fiel do ASR.")
                throw new InvalidOperationException("Texto ASR não foi enviado à análise.");
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = JsonContent.Create(new {
                choices = new[] { new { finish_reason = "stop", message = new { content = payload } } }
            }) };
        }
    }

    private sealed class GeminiFixture(string payload) : HttpMessageHandler
    {
        public int Requests { get; private set; }
        public bool AlwaysFail { get; set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests++;
            if (request.RequestUri?.Host != "generativelanguage.googleapis.com" || !request.Headers.Contains("x-goog-api-key"))
                throw new InvalidOperationException("Host/chave do adaptador incorretos.");
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            var inline = body.RootElement.GetProperty("contents")[0].GetProperty("parts")[1].GetProperty("inlineData");
            if (inline.GetProperty("mimeType").GetString() != "audio/wav" || Convert.FromBase64String(inline.GetProperty("data").GetString()!).Length != 12 ||
                body.RootElement.GetProperty("generationConfig").GetProperty("responseMimeType").GetString() != "application/json")
                throw new InvalidOperationException("Envelope do adaptador de áudio inválido.");
            if (AlwaysFail || Requests == 1) return new HttpResponseMessage(System.Net.HttpStatusCode.TooManyRequests);
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(new {
                candidates = new[] { new { finishReason = "STOP", content = new { parts = new[] { new { text = payload } } } } }
            })) };
        }
    }

    private sealed class RejectNetwork : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            throw new InvalidOperationException("O teste offline não pode acessar a rede.");
    }
}

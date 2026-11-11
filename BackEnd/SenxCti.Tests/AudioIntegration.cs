using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using SenxCti.Api.Auth;
using SenxCti.Api.Services.Ai;
using SenxCti.Api.Services.Audio;

internal static class AudioIntegration
{
    public static async Task<int> Run()
    {
        var secret = Environment.GetEnvironmentVariable("SENX_TEST_DB_CONNECTION");
        if (string.IsNullOrWhiteSpace(secret)) { Console.WriteLine("FALTA SENX_TEST_DB_CONNECTION explícita; nenhum banco foi alterado."); return 1; }
        var api = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../SenxCti.Api"));
        var team = Guid.NewGuid(); var customer = Guid.NewGuid();
        var marker = Guid.NewGuid().ToString("N"); var password = "QA!" + marker;
        var email = "qa-audio-" + marker + "@example.invalid";
        var audio = Path.Combine(Path.GetTempPath(), "senx-upload-test-" + marker);
        Directory.CreateDirectory(audio);
        Guid admin = default, user = default, call = default, analysis = default;
        int checks = 0;
        void Check(bool ok, string label) { if (!ok) throw new InvalidOperationException(label); checks++; }
        await using var db = new NpgsqlConnection(secret);
        await db.OpenAsync();
        async Task Sql(string sql)
        {
            await using var cmd = new NpgsqlCommand(sql, db);
            cmd.Parameters.AddWithValue("team", team); cmd.Parameters.AddWithValue("customer", customer);
            cmd.Parameters.AddWithValue("admin", admin); cmd.Parameters.AddWithValue("user", user);
            await cmd.ExecuteNonQueryAsync();
        }
        using var factory = new AudioFactory(api, secret, audio);
        using var client = factory.CreateClient();
        using var collaborator = factory.CreateClient();
        using var anonymous = factory.CreateClient();
        async Task<HttpResponseMessage> Write(HttpClient http, HttpMethod method, string path, object body)
        {
            var csrf = await http.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
            using var request = new HttpRequestMessage(method, path) { Content = JsonContent.Create(body) };
            request.Headers.Add("X-CSRF-Token", csrf.GetProperty("token").GetString());
            return await http.SendAsync(request);
        }
        async Task<HttpResponseMessage> Upload(HttpClient http, byte[] bytes, string filename, Guid employee, bool csrf = true)
        {
            using var form = new MultipartFormDataContent();
            form.Add(new ByteArrayContent(bytes), "audio", filename);
            form.Add(new StringContent(employee.ToString()), "IdFuncionario");
            form.Add(new StringContent(customer.ToString()), "IdCliente");
            form.Add(new StringContent("11999999997"), "NumeroOrigem");
            form.Add(new StringContent("11888888888"), "NumeroDestino");
            form.Add(new StringContent("Entrada"), "Direcao");
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/ligacoes/upload") { Content = form };
            if (csrf)
            {
                var token = await http.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
                request.Headers.Add("X-CSRF-Token", token.GetProperty("token").GetString());
            }
            return await http.SendAsync(request);
        }
        // One second of silent PCM: it is a fixture, never a real customer recording.
        byte[] wav = new byte[32044];
        "RIFF"u8.CopyTo(wav); BitConverter.GetBytes(wav.Length - 8).CopyTo(wav, 4);
        "WAVEfmt "u8.CopyTo(wav.AsSpan(8)); BitConverter.GetBytes(16).CopyTo(wav, 16);
        BitConverter.GetBytes((short)1).CopyTo(wav, 20); BitConverter.GetBytes((short)1).CopyTo(wav, 22);
        BitConverter.GetBytes(16000).CopyTo(wav, 24); BitConverter.GetBytes(32000).CopyTo(wav, 28);
        BitConverter.GetBytes((short)2).CopyTo(wav, 32); BitConverter.GetBytes((short)16).CopyTo(wav, 34);
        "data"u8.CopyTo(wav.AsSpan(36)); BitConverter.GetBytes(32000).CopyTo(wav, 40);
        try
        {
            Check((await anonymous.GetAsync("/api/ligacoes/upload-options")).StatusCode == HttpStatusCode.Unauthorized, "Opções exigem sessão autenticada");
            await Sql("""INSERT INTO public."Equipe" ("IdEquipe","Nome","Departamento") VALUES (@team,'QA áudio 1.0','QA')""");
            var auth = factory.Services.GetRequiredService<AuthRepository>();
            admin = await auth.Create(new("QA Áudio Admin", email, password, team, "QA", "Administrador"), default);
            user = await auth.Create(new("QA Áudio Colaborador", "user-" + email, password, team, "QA", "Colaborador"), default);
            await Sql("""INSERT INTO public."DadosCliente" ("IdDadosCliente","IdUsuario","Nome","Email","Telefone","Situacao","Consentimento") VALUES (@customer,@user,'QA Áudio','qa-audio@example.invalid','11999999997','Teste',true)""");
            Check((await Write(client, HttpMethod.Post, "/api/auth/login", new { email, password })).IsSuccessStatusCode, "Login administrador");
            Check((await Write(collaborator, HttpMethod.Post, "/api/auth/login", new { email = "user-" + email, password })).IsSuccessStatusCode, "Login colaborador");
            Check((await Upload(client, wav, "sample.wav", user, false)).StatusCode == HttpStatusCode.Forbidden, "Upload exige CSRF");
            Check((await Upload(client, "not-audio"u8.ToArray(), "sample.wav", user)).StatusCode == HttpStatusCode.UnsupportedMediaType, "Header falso recusado");
            Check((await Upload(collaborator, wav, "sample.wav", admin)).StatusCode == HttpStatusCode.Forbidden, "Colaborador não atribui ligação a outra pessoa");
            Check((await client.GetFromJsonAsync<JsonElement>("/api/ligacoes/upload-options")).GetProperty("customers").EnumerateArray().Any(x => x.GetProperty("id").GetGuid() == customer), "Cliente disponível no formulário");
            foreach (var failureMode in new[] { "provider", "database" })
            {
                factory.Ai.FailureMode = failureMode;
                Check((await Upload(client, wav, "failure.wav", user)).StatusCode == HttpStatusCode.ServiceUnavailable, "Falha controlada: " + failureMode);
                await using var count = new NpgsqlCommand("""SELECT count(*) FROM public."Ligacao" WHERE "IdFuncionario"=@user""", db);
                count.Parameters.AddWithValue("user", user);
                Check((long)(await count.ExecuteScalarAsync())! == 0, "Falha não deixa ligação parcial: " + failureMode);
                Check(Directory.GetFiles(audio).Length == 0, "Falha remove arquivo temporário: " + failureMode);
            }
            factory.Ai.FailureMode = null;
            var upload = await Upload(client, wav, "../../sample.wav", user);
            Check(upload.StatusCode == HttpStatusCode.Created, "Upload cria ligação e análise");
            var result = await upload.Content.ReadFromJsonAsync<JsonElement>();
            call = result.GetProperty("id").GetGuid(); analysis = result.GetProperty("analysisId").GetGuid();
            Check(result.GetProperty("simulated").GetBoolean(), "Resultado simulado identificado explicitamente");
            var stored = Directory.GetFiles(audio).Single();
            Check(Path.GetFileName(stored) == call.ToString("N") + ".wav" && (await File.ReadAllBytesAsync(stored)).SequenceEqual(wav), "Nome gerado sem path traversal; bytes preservados");
            await using (var cmd = new NpgsqlCommand("""SELECT l."Stats",length(l."Hash_Audio"),a."StatusProcessamento",a."Modelo_Versao" FROM public."Ligacao" l JOIN public."Analise" a ON a."IdLigacao"=l."IdLigacao" WHERE l."IdLigacao"=@call""", db))
            {
                cmd.Parameters.AddWithValue("call", call); await using var reader = await cmd.ExecuteReaderAsync(); await reader.ReadAsync();
                Check(reader.GetString(0) == "Processada" && reader.GetInt32(1) == 64 && reader.GetBoolean(2) && reader.GetString(3).Contains("simulado"), "Hash, estado e análise persistidos no PostgreSQL");
            }
            Check((await Write(client, HttpMethod.Put, $"/api/data/calls/{call}/review", new { analysisId = analysis, revision = (Guid?)null, summary = "Revisão humana da fixture", score = 75, validate = true })).IsSuccessStatusCode, "Revisão humana da análise enviada");
            Check((await Write(client, HttpMethod.Post, "/api/data/reports", new { title = "QA E2E áudio " + marker, type = "Qualidade", teamId = team, period = "Últimos 7 dias", summary = "Fixture com IA simulada" })).StatusCode == HttpStatusCode.Created, "Relatório gerado após ingestão e revisão");
            var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/data/snapshot");
            var report = snapshot.GetProperty("reports").EnumerateArray().Single(x => x.GetProperty("teamId").ValueKind == JsonValueKind.String && x.GetProperty("teamId").GetGuid() == team);
            Check(report.GetProperty("total").GetInt64() == 1 && report.GetProperty("reviewed").GetInt64() == 0 && report.GetProperty("simulated").GetInt64() == 1 && report.GetProperty("averageScore").ValueKind == JsonValueKind.Null, "Relatório identifica simulação e exclui sua nota dos indicadores reais");
            var savedCall = snapshot.GetProperty("calls").EnumerateArray().Single(x => x.GetProperty("id").GetGuid() == call);
            Check(savedCall.GetProperty("reviewed").GetBoolean(), "Revisão humana da simulação permanece registrada");
            Check(savedCall.GetProperty("seconds").GetDouble() == 1, "Duração real persistida e retornada no snapshot");
            Check((await Write(client, HttpMethod.Post, "/api/ligacoes/import", new { fileName = "../outside.wav", idFuncionario = user, idCliente = customer, numeroOrigem = "11999999999", numeroDestino = "11888888888", direcao = "Entrada" })).StatusCode == HttpStatusCode.BadRequest, "Importação recusa saída da pasta");
            Check((await Write(client, HttpMethod.Post, "/api/ligacoes/import", new { fileName = Path.GetFileName(stored), idFuncionario = user, idCliente = customer, numeroOrigem = (string?)null, numeroDestino = "11888888888", direcao = "Entrada" })).StatusCode == HttpStatusCode.BadRequest, "Importação recusa número ausente");
            Check((await Write(client, HttpMethod.Post, "/api/ligacoes/import", new { fileName = Path.GetFileName(stored), idFuncionario = user, idCliente = customer, numeroOrigem = "11999999997", numeroDestino = "11888888888", direcao = "Entrada" })).StatusCode == HttpStatusCode.Created, "Leitura da pasta autorizada cria análise");
            Console.WriteLine($"Áudio → análise simulada → revisão → relatório: {checks} verificações aprovadas.");
            return 0;
        }
        catch (Exception e) { Console.WriteLine("FAIL áudio: " + e.GetType().Name + " " + (e is PostgresException pg ? pg.SqlState : e.Message)); return 1; }
        finally
        {
            await Sql("""
                DELETE FROM public."Relatorio" WHERE "IdAutor"=@admin;
                DELETE FROM public."RevisaoHumana" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao" IN (SELECT "IdLigacao" FROM public."Ligacao" WHERE "IdFuncionario"=@user));
                DELETE FROM public."Resultado" WHERE "IdFuncionario"=@user;
                DELETE FROM public."Analise" WHERE "IdLigacao" IN (SELECT "IdLigacao" FROM public."Ligacao" WHERE "IdFuncionario"=@user);
                DELETE FROM public."Ligacao" WHERE "IdFuncionario"=@user;
                DELETE FROM public."DadosCliente" WHERE "IdDadosCliente"=@customer;
                DELETE FROM public."Usuario" WHERE "IdUsuario" IN (@admin,@user);
                DELETE FROM public."Equipe" WHERE "IdEquipe"=@team;
                """);
            Directory.Delete(audio, true);
            Console.WriteLine("QA removida somente pelos IDs próprios da execução.");
        }
    }

    private sealed class AudioFactory(string api, string connection, string audio) : WebApplicationFactory<SenxCti.Api.Controllers.UsuarioController>
    {
        public FixtureAi Ai { get; } = new();
        protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Development").UseContentRoot(api)
            .ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["SENX_DB_CONNECTION"] = connection, ["SENX_AUDIO_ROOT"] = audio, ["Jwt:Key"] = new string('q', 40) }))
            .ConfigureServices(services => { services.RemoveAll<IAiAnalysisService>(); services.AddSingleton<IAiAnalysisService>(Ai); });
    }
    private sealed class FixtureAi : IAiAnalysisService
    {
        public string? FailureMode { get; set; }
        public Task<AiAnalysisResult> ProcessAudioAsync(string path, CancellationToken ct)
        {
            if (FailureMode == "provider") throw new AiProcessingException("Falha controlada do provedor.");
            var result = new AiAnalysisResult("Fixture simulada, não transcrição do áudio.", "Resumo de QA", false, false, 0, "Fixture", "Nenhum", "Revisar", "offline/simulado-teste-v1", Simulada: true);
            // Force a foreign-key failure after the call and analysis INSERTs.
            if (FailureMode == "database") result = result with { Resultados = [new(Guid.NewGuid(), 80, "Critério inexistente para verificar rollback")] };
            return Task.FromResult(result);
        }
    }
}

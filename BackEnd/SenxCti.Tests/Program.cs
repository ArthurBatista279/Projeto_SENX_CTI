using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SenxCti.Api.Data;
using SenxCti.Api.Models;

if (args.Contains("--crud-integration") || args.Contains("--anonymous-crud"))
{
    Environment.ExitCode = await CrudIntegration.Run(args.Contains("--anonymous-crud"));
    return;
}
if (args.Contains("--delivery-integration"))
{
    Environment.ExitCode = await DeliveryIntegration.Run();
    return;
}
if (args.Contains("--database-readonly"))
{
    Environment.ExitCode = await DatabaseReadOnly.Check();
    return;
}

var assembly = typeof(Usuario).Assembly;
string[] names = ["Alerta", "Analise", "Assunto", "Criterio", "DadosCliente", "Equipe", "Ligacao", "Registro", "Resultado"];
int passed = 0, failed = 0;
int previousPassed = 0, previousFailed = 0;
void ReportRound()
{
    Console.WriteLine($"Resultado da rodada: {passed - previousPassed} passaram; {failed - previousFailed} falharam.");
    previousPassed = passed;
    previousFailed = failed;
}
void Check(bool ok, string label)
{
    if (ok) Interlocked.Increment(ref passed);
    else { Interlocked.Increment(ref failed); Console.WriteLine("FAIL: " + label); }
}
async Task Status(HttpResponseMessage response, HttpStatusCode expected, string label)
{
    using (response)
        Check(response.StatusCode == expected, $"{label}: esperado {(int)expected}, recebido {(int)response.StatusCode}: {(response.StatusCode == expected ? "" : await response.Content.ReadAsStringAsync())}");
}
Dictionary<string, object?> Sample(string name)
{
    var result = new Dictionary<string, object?>();
    foreach (var p in assembly.GetType("SenxCti.Api.Models." + name)!.GetProperties())
    {
        var t = Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType;
        if (t == typeof(string)) result[p.Name] = p.Name == "Email" ? "teste@example.com" : "teste";
        else if (t == typeof(Guid)) result[p.Name] = Guid.NewGuid();
        else if (t == typeof(DateTime)) result[p.Name] = new DateTime(2026, 1, 1);
        else if (t == typeof(TimeOnly)) result[p.Name] = new TimeOnly(0, 2);
        else if (t == typeof(bool)) result[p.Name] = false;
        else if (t == typeof(int)) result[p.Name] = 10;
    }
    return result;
}

Console.WriteLine("RODADA 1: repositorios reais com entidades rastreadas; SaveChanges isolado (sem SQL)");
foreach (var name in names)
{
    using var db = new TrackingContext();
    var type = assembly.GetType("SenxCti.Api.Models." + name)!;
    var entity = JsonSerializer.Deserialize(JsonSerializer.Serialize(Sample(name)), type)!;
    var key = type.GetProperty("Id" + name)!;
    var id = (Guid)key.GetValue(entity)!;
    db.Attach(entity);
    var repo = Activator.CreateInstance(assembly.GetType("SenxCti.Api.Repositories." + name + "Repository")!, db)!;
    try
    {
        Check(ReferenceEquals(repo.GetType().GetMethod("BuscarPorId")!.Invoke(repo, [id]), entity), name + " busca Guid");
        var updated = JsonSerializer.Deserialize(JsonSerializer.Serialize(Sample(name)), type)!;
        key.SetValue(updated, id);
        foreach (var method in new[] { "AtualizarIdUrl", "AtualizarIdCorpo" })
        {
            repo.GetType().GetMethod(method)!.Invoke(repo, method.EndsWith("Url") ? [id, updated] : [updated]);
            foreach (var p in type.GetProperties().Where(p => !p.GetMethod!.IsVirtual))
                Check(Equals(p.GetValue(entity), p.GetValue(updated)), name + "." + method + "." + p.Name);
        }
        repo.GetType().GetMethod("Deletar")!.Invoke(repo, [id]);
        Check(db.Entry(entity).State == EntityState.Deleted, name + " exclusao");
    }
    catch (Exception e) { Check(false, name + ": " + e.GetBaseException().Message); }
}

ReportRound();
using var factory = new IsolatedFactory();
using var client = factory.CreateClient();
client.DefaultRequestHeaders.Add("X-Test-Role", "Administrador");
Console.WriteLine("RODADA 2: HTTP CRUD, IDs ausentes, invalidos e validacao de JSON");
foreach (var name in names)
{
    var route = "/api/" + name;
    var missing = Guid.NewGuid();
    await Status(await client.GetAsync(route + "/" + missing), HttpStatusCode.NotFound, name + " GET inexistente");
    await Status(await client.DeleteAsync(route + "/" + missing), HttpStatusCode.NotFound, name + " DELETE inexistente");
    var sample = Sample(name);
    await Status(await client.PostAsJsonAsync(route, new { }), HttpStatusCode.BadRequest, name + " campos obrigatorios");
    await Status(await client.PutAsJsonAsync(route + "/" + Guid.Empty, sample), HttpStatusCode.BadRequest, name + " PUT URL vazio");
    await Status(await client.DeleteAsync(route + "/" + Guid.Empty), HttpStatusCode.BadRequest, name + " DELETE vazio");
    await Status(await client.PutAsJsonAsync(route + "/" + missing, sample), HttpStatusCode.NotFound, name + " PUT inexistente");
    await Status(await client.PutAsJsonAsync(route, sample), HttpStatusCode.NotFound, name + " PUT corpo inexistente");
    sample["Id" + name] = Guid.Empty;
    await Status(await client.PutAsJsonAsync(route, sample), HttpStatusCode.BadRequest, name + " ID vazio");
    await Status(await client.PostAsync(route, new StringContent("{", System.Text.Encoding.UTF8, "application/json")), HttpStatusCode.BadRequest, name + " JSON invalido");
    await Status(await client.PostAsJsonAsync(route, sample), HttpStatusCode.Created, name + " POST sem navegacoes");
    using (var modelContext = new TrackingContext())
    {
        foreach (var property in modelContext.Model.FindEntityType(assembly.GetType("SenxCti.Api.Models." + name)!)!
            .GetProperties().Where(p => p.GetMaxLength() is not null))
        {
            var tooLong = new Dictionary<string, object?>(sample) { [property.Name] = new string('x', property.GetMaxLength()!.Value + 1) };
            await Status(await client.PostAsJsonAsync(route, tooLong), HttpStatusCode.BadRequest, name + "." + property.Name + " limite PostgreSQL");
        }
    }
    var proxy = factory.Repositories[name];
    proxy.CreateError = new TimeoutException("internal-secret-test");
    await Status(await client.PostAsJsonAsync(route, sample), HttpStatusCode.ServiceUnavailable, name + " timeout tratado");
    proxy.CreateError = new DbUpdateException("internal-secret-test", new Npgsql.PostgresException("internal-secret-test", "ERROR", "ERROR", "23503"));
    var conflict = await client.PostAsJsonAsync(route, sample);
    Check(!(await conflict.Content.ReadAsStringAsync()).Contains("internal-secret-test"), name + " erro nao expoe detalhes");
    await Status(conflict, HttpStatusCode.Conflict, name + " conflito FK tratado");
    proxy.CreateError = null;
    proxy.CreateError = new DbUpdateException("internal-secret-test", new Npgsql.NpgsqlException("internal-secret-test"));
    var unavailable = await client.PostAsJsonAsync(route, sample);
    Check(!(await unavailable.Content.ReadAsStringAsync()).Contains("internal-secret-test"), name + " falha EF nao expoe detalhes");
    await Status(unavailable, HttpStatusCode.ServiceUnavailable, name + " indisponibilidade encapsulada pelo EF");
    proxy.CreateError = null;
    var id = proxy.Rows.Keys.FirstOrDefault();
    if (id == Guid.Empty) continue;
    await Status(await client.GetAsync(route + "/" + id), HttpStatusCode.OK, name + " GET cadastrado");
    sample["Id" + name] = id;
    await Status(await client.PutAsJsonAsync(route + "/" + id, sample), HttpStatusCode.NoContent, name + " PUT URL");
    await Status(await client.PutAsJsonAsync(route, sample), HttpStatusCode.NoContent, name + " PUT corpo");
    await Status(await client.DeleteAsync(route + "/" + id), HttpStatusCode.NoContent, name + " DELETE");
    await Status(await client.GetAsync(route + "/" + id), HttpStatusCode.NotFound, name + " GET excluido");
}

ReportRound();
Console.WriteLine("RODADA 3: upload, tamanho, extensoes, rollback e preservacao");
MultipartFormDataContent Form(byte[]? bytes = null, string filename = "foto.png")
{
    var form = new MultipartFormDataContent();
    foreach (var item in new Dictionary<string,string> { ["IdEquipe"] = Guid.NewGuid().ToString(), ["Nome"] = "Teste", ["Email"] = "teste@example.com", ["Cargo"] = "Analista", ["Senha"] = "SenhaTeste123456", ["Perfil"] = "Colaborador" })
        form.Add(new StringContent(item.Value), item.Key);
    if (bytes is not null) form.Add(new ByteArrayContent(bytes), "Imagem", filename);
    return form;
}
byte[] png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=");
await Status(await client.PostAsync("/api/Usuario", Form(png, "foto.exe")), HttpStatusCode.BadRequest, "extensao proibida");
await Status(await client.PostAsync("/api/Usuario", Form(new byte[5 * 1024 * 1024 + 1])), HttpStatusCode.BadRequest, "imagem acima de 5MB");
var upload = await client.PostAsync("/api/Usuario", Form(png));
Check(upload.StatusCode == HttpStatusCode.Created, "upload valido");
if (upload.IsSuccessStatusCode)
{
    var json = await upload.Content.ReadFromJsonAsync<JsonElement>();
    var filename = json.GetProperty("imagem").GetString()!;
    var id = json.GetProperty("idUsuario").GetGuid();
    Check(!json.TryGetProperty("senha", out _), "resposta sem senha");
    Check(File.ReadAllBytes(Path.Combine(factory.Root, "wwwroot", "imagens", filename)).SequenceEqual(png), "arquivo gravado integralmente");
    await Status(await client.GetAsync("/imagens/" + filename), HttpStatusCode.OK, "imagem publicada");
    await Status(await client.PutAsync("/api/Usuario/" + id, Form()), HttpStatusCode.NoContent, "PUT sem imagem");
    Check(((Usuario)factory.Repositories["Usuario"].Rows[id]).Imagem == filename, "preserva imagem existente");
}
var folder = Path.Combine(factory.Root, "wwwroot", "imagens");
var before = Directory.GetFiles(folder).Length;
factory.Repositories["Usuario"].FailCreate = true;
await Status(await client.PostAsync("/api/Usuario", Form(png)), HttpStatusCode.ServiceUnavailable, "falha no repositorio");
Check(Directory.GetFiles(folder).Length == before, "rollback remove arquivo");
factory.Repositories["Usuario"].FailCreate = false;

ReportRound();
Console.WriteLine("RODADA 4: autorizacao, swagger e respostas publicas");
using var anonymous = factory.CreateClient();
foreach (var name in names.Append("Usuario"))
    await Status(await anonymous.GetAsync("/api/" + name), HttpStatusCode.Unauthorized, name + " anonimo bloqueado");
anonymous.DefaultRequestHeaders.Add("X-Test-Role", "Colaborador");
await Status(await anonymous.GetAsync("/api/Usuario"), HttpStatusCode.Forbidden, "usuario exige admin");
foreach (var name in names.Where(n => n != "Criterio"))
{
    var route = "/api/" + name;
    var sample = Sample(name);
    var id = (Guid)sample["Id" + name]!;
    await Status(await anonymous.GetAsync(route), HttpStatusCode.Forbidden, name + " listagem global exige admin");
    await Status(await anonymous.GetAsync(route + "/" + id), HttpStatusCode.Forbidden, name + " leitura global exige admin");
    await Status(await anonymous.PostAsJsonAsync(route, sample), HttpStatusCode.Forbidden, name + " POST exige admin");
    await Status(await anonymous.PutAsJsonAsync(route, sample), HttpStatusCode.Forbidden, name + " PUT corpo exige admin");
    await Status(await anonymous.PutAsJsonAsync(route + "/" + id, sample), HttpStatusCode.Forbidden, name + " PUT URL exige admin");
    await Status(await anonymous.DeleteAsync(route + "/" + id), HttpStatusCode.Forbidden, name + " DELETE exige admin");
}
var criterion = Sample("Criterio");
var criterionId = (Guid)criterion["IdCriterio"]!;
await Status(await anonymous.PostAsJsonAsync("/api/Criterio", criterion), HttpStatusCode.Forbidden, "criterio POST exige admin");
await Status(await anonymous.PutAsJsonAsync("/api/Criterio", criterion), HttpStatusCode.Forbidden, "criterio PUT corpo exige admin");
await Status(await anonymous.PutAsJsonAsync("/api/Criterio/" + criterionId, criterion), HttpStatusCode.Forbidden, "criterio PUT URL exige admin");
await Status(await anonymous.DeleteAsync("/api/Criterio/" + criterionId), HttpStatusCode.Forbidden, "criterio DELETE exige admin");
factory.Repositories["Criterio"].Rows.Clear();
factory.Repositories["Criterio"].Rows[criterionId] = new Criterio { IdCriterio = criterionId, Ativo = false };
var activeId = Guid.NewGuid();
factory.Repositories["Criterio"].Rows[activeId] = new Criterio { IdCriterio = activeId, Ativo = true };
var visibleCriteria = await anonymous.GetFromJsonAsync<Criterio[]>("/api/Criterio");
Check(visibleCriteria is { Length: 1 } && visibleCriteria[0].IdCriterio == activeId, "colaborador ve apenas criterios ativos");
await Status(await anonymous.GetAsync("/api/Criterio/" + criterionId), HttpStatusCode.NotFound, "criterio inativo oculto");
await Status(await anonymous.GetAsync("/api/Criterio/" + activeId), HttpStatusCode.OK, "criterio ativo visivel");
await Status(await client.GetAsync("/api/Criterio/" + criterionId), HttpStatusCode.OK, "admin ve criterio inativo");
await Status(await client.GetAsync("/api/health"), HttpStatusCode.OK, "health");
await Status(await client.GetAsync("/swagger/v1/swagger.json"), HttpStatusCode.OK, "swagger gerado");
await Status(await client.GetAsync("/nao-existe"), HttpStatusCode.NotFound, "rota inexistente");

ReportRound();
Console.WriteLine("RODADA 5: 1000 requisicoes HTTP, concorrencia maxima 20 (repositorios simulados)");
var timer = Stopwatch.StartNew();
await Parallel.ForEachAsync(Enumerable.Range(0, 1000), new ParallelOptions { MaxDegreeOfParallelism = 20 }, async (i, ct) =>
{
    await Status(await client.GetAsync(i % 2 == 0 ? "/api/health" : "/api/Equipe", ct), HttpStatusCode.OK, "carga " + i);
});
ReportRound();
Console.WriteLine($"Carga: {timer.ElapsedMilliseconds} ms. TOTAL: {passed} passaram; {failed} falharam.");
Environment.ExitCode = failed == 0 ? 0 : 1;

public class TrackingContext() : SenxContext(new DbContextOptionsBuilder<SenxContext>().UseNpgsql("Host=127.0.0.1;Database=never_connected").Options)
{
    public override int SaveChanges() => 1;
}
public class RepositoryDouble : DispatchProxy
{
    public ConcurrentDictionary<Guid, object> Rows = new();
    public Type EntityType = null!;
    public bool FailCreate;
    public Exception? CreateError;
    protected override object? Invoke(MethodInfo? method, object?[]? args)
    {
        args ??= [];
        var key = EntityType.GetProperty("Id" + EntityType.Name)!;
        switch (method!.Name)
        {
            case "BuscarPorId": return Rows.GetValueOrDefault((Guid)args[0]!);
            case "Listar":
                var list = (System.Collections.IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(EntityType))!;
                foreach (var row in Rows.Values) list.Add(row);
                return list;
            case "Cadastrar":
                if (CreateError is not null) throw CreateError;
                if (FailCreate) throw new TimeoutException("Falha simulada");
                var id = Guid.NewGuid(); key.SetValue(args[0], id); Rows[id] = args[0]!;
                return method.ReturnType == typeof(void) ? null : args[0];
            case "AtualizarIdUrl": Rows[(Guid)args[0]!] = args[1]!; return null;
            case "AtualizarIdCorpo": Rows[(Guid)key.GetValue(args[0])!] = args[0]!; return null;
            case "Deletar": Rows.TryRemove((Guid)args[0]!, out _); return null;
            default: throw new NotSupportedException(method.Name);
        }
    }
}
public class IsolatedFactory : WebApplicationFactory<SenxCti.Api.Controllers.UsuarioController>
{
    public string Root = Path.Combine(Path.GetTempPath(), "senx-tests-" + Guid.NewGuid());
    public Dictionary<string, RepositoryDouble> Repositories = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(Root);
        builder.UseEnvironment("Development").UseContentRoot(Root);
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string,string?> { ["SENX_DB_CONNECTION"] = "", ["Jwt:Key"] = new string('t', 40) }));
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.ConfigureTestServices(services =>
        {
            services.Configure<AuthenticationOptions>(o => o.SchemeMap["Bearer"].HandlerType = typeof(TestAuth));
            services.AddTransient<TestAuth>();
            var assembly = typeof(Usuario).Assembly;
            foreach (var iface in assembly.GetTypes().Where(t => t.IsInterface && t.Namespace == "SenxCti.Api.Interfaces"))
            {
                var name = iface.Name[1..^10];
                var proxy = (RepositoryDouble)DispatchProxy.Create(iface, typeof(RepositoryDouble));
                proxy.EntityType = assembly.GetType("SenxCti.Api.Models." + name)!;
                Repositories[name] = proxy;
                services.AddSingleton(iface, proxy);
            }
        });
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        // Only this factory's unique temporary directory is removed.
        if (Directory.Exists(Root)) Directory.Delete(Root, true);
    }
}
public class TestAuth(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Test-Role", out var role)) return Task.FromResult(AuthenticateResult.NoResult());
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()), new Claim(ClaimTypes.Role, role.ToString())], Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
    }
}

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SenxCti.Api.Auth;
using SenxCti.Api.Data;
using SenxCti.Api.Models;

internal static class CrudIntegration
{
    public static async Task<int> Run(bool anonymous = false)
    {
        var api = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../SenxCti.Api"));
        var config = new ConfigurationBuilder().SetBasePath(api).AddJsonFile("appsettings.Local.json", true).AddEnvironmentVariables().Build();
        var connection = config["SENX_DB_CONNECTION"];
        if (string.IsNullOrWhiteSpace(connection)) { Console.WriteLine("FALTA: conexao PostgreSQL."); return 1; }
        using var factory = new Factory(api, connection, anonymous);
        using var client = factory.CreateClient();
        await using var db = new SenxContext(new DbContextOptionsBuilder<SenxContext>().UseNpgsql(connection).Options);
        var marker = "qa" + Guid.NewGuid().ToString("N")[..8];
        var password = "Qa!" + Guid.NewGuid().ToString("N");
        var email = marker + "@example.invalid";
        var bootstrapTeam = new Equipe { IdEquipe = Guid.NewGuid(), Nome = marker, Departamento = marker };
        Guid admin = default;
        var rows = new List<(string Name, Guid Id)>();
        var ids = new Dictionary<string, Guid>();
        int passed = 0;
        void Check(bool ok, string label) { if (!ok) throw new Exception(label); passed++; }
        async Task Expect(HttpResponseMessage response, HttpStatusCode status, string label)
        {
            using (response) Check(response.StatusCode == status, $"{label}: esperado {(int)status}, recebido {(int)response.StatusCode}");
        }
        async Task Cleanup(string name, Guid id)
        {
            var entity = db.Model.GetEntityTypes().Single(e => e.ClrType.Name == name);
            var row = await db.FindAsync(entity.ClrType, id);
            if (row is null) return;
            db.Remove(row);
            await db.SaveChangesAsync();
        }
        MultipartFormDataContent UserForm(string name) {
            var form = new MultipartFormDataContent();
            foreach (var pair in new Dictionary<string,string> { ["Nome"]=name, ["Email"]=marker+"-user@example.invalid", ["Senha"]=password, ["Cargo"]="QA", ["Perfil"]="Colaborador", ["IdEquipe"]=ids["Equipe"].ToString() })
                form.Add(new StringContent(pair.Value),pair.Key);
            return form;
        }
        try
        {
            db.Equipe.Add(bootstrapTeam); await db.SaveChangesAsync();
            if (!anonymous)
            {
            admin = await factory.Services.GetRequiredService<AuthRepository>().Create(new("QA", email, password, bootstrapTeam.IdEquipe, "QA", "Administrador"), default);
            using var login = await client.PostAsJsonAsync("/api/Login", new { email, senha=password });
            Check(login.StatusCode == HttpStatusCode.OK, "Login JWT real");
            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }
            await Expect(await client.GetAsync("/swagger/index.html"), HttpStatusCode.OK, "Swagger UI");
            await Expect(await client.GetAsync("/swagger/v1/swagger.json"), HttpStatusCode.OK, "OpenAPI");
            foreach (var name in new[] { "Equipe", "Usuario", "DadosCliente", "Ligacao", "Analise", "Criterio", "Assunto", "Alerta", "Registro", "Resultado" })
            {
                var route = "/api/" + name;
                var type = typeof(Equipe).Assembly.GetType("SenxCti.Api.Models." + name)!;
                var body = new Dictionary<string, object?>();
                foreach (var prop in type.GetProperties().Where(p => !p.GetMethod!.IsVirtual))
                {
                    var t = Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType;
                    if (t == typeof(string)) body[prop.Name] = prop.Name == "Email" ? email : marker;
                    else if (t == typeof(Guid)) body[prop.Name] = prop.Name == "Id"+name ? Guid.Empty : ids[prop.Name switch { "IdFuncionario" => "Usuario", "IdCliente" => "DadosCliente", _ => prop.Name[2..] }];
                    else if (t == typeof(DateTime)) body[prop.Name] = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
                    else if (t == typeof(TimeOnly)) body[prop.Name] = new TimeOnly(0, 2);
                    else if (t == typeof(bool)) body[prop.Name] = name != "Criterio";
                    else if (t == typeof(int)) body[prop.Name] = 50;
                }
                await Expect(name == "Usuario" ? await client.PostAsync(route, UserForm(marker)) : await client.PostAsJsonAsync(route, body), HttpStatusCode.Created, name+" POST");
                using var listResponse = await client.GetAsync(route);
                Check(listResponse.StatusCode == HttpStatusCode.OK, name+" GET lista");
                var list = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
                var field = type.GetProperties().First(p => p.PropertyType == typeof(string) && p.Name != "Email" && p.Name != "Perfil").Name;
                var jsonField = JsonNamingPolicy.CamelCase.ConvertName(field);
                var key = "id"+name;
                var row = list.EnumerateArray().Single(r => r.GetProperty(jsonField).GetString() == marker && (name != "Equipe" || r.GetProperty(key).GetGuid() != bootstrapTeam.IdEquipe));
                var id = row.GetProperty(key).GetGuid();
                ids[name] = id; rows.Add((name,id)); body["Id"+name] = id;
                await Expect(await client.GetAsync(route+"/"+id), HttpStatusCode.OK, name+" GET ID");
                body[field] = "updated";
                await Expect(name == "Usuario" ? await client.PutAsync(route+"/"+id, UserForm("updated")) : await client.PutAsJsonAsync(route+"/"+id,body), HttpStatusCode.NoContent,name+" PUT URL");
                var reread = await client.GetFromJsonAsync<JsonElement>(route+"/"+id);
                Check(reread.GetProperty(jsonField).GetString() == "updated",name+" persistencia PUT URL");
                if (name != "Usuario") {
                    body[field] = "changed";
                    await Expect(await client.PutAsJsonAsync(route,body),HttpStatusCode.NoContent,name+" PUT corpo");
                    reread = await client.GetFromJsonAsync<JsonElement>(route+"/"+id);
                    Check(reread.GetProperty(jsonField).GetString() == "changed",name+" persistencia PUT corpo");
                }
                Console.WriteLine("PASS: " + name + " POST / GET / PUT persistidos");
            }
            foreach (var (name,id) in rows.AsEnumerable().Reverse()) {
                await Expect(await client.DeleteAsync($"/api/{name}/{id}"),HttpStatusCode.NoContent,name+" DELETE");
                await Expect(await client.GetAsync($"/api/{name}/{id}"),HttpStatusCode.NotFound,name+" GET apos DELETE");
                Console.WriteLine("PASS: " + name + " DELETE / GET 404");
            }
            Console.WriteLine($"CRUD PostgreSQL/{(anonymous ? "sem login" : "JWT")}: {passed} verificacoes aprovadas.");
            return 0;
        }
        catch (Exception error) { Console.WriteLine("FAIL CRUD: " + (error is Npgsql.PostgresException pg ? pg.SqlState : error.Message)); return 1; }
        finally {
            foreach (var (name,id) in rows.AsEnumerable().Reverse()) await Cleanup(name,id);
            if (admin != default) await Cleanup("Usuario",admin);
            await Cleanup("Equipe",bootstrapTeam.IdEquipe);
            Console.WriteLine("Limpeza dos IDs temporarios concluida.");
        }
    }
    private sealed class Factory(string api, string connection, bool anonymous) : WebApplicationFactory<SenxCti.Api.Controllers.UsuarioController>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Development").UseContentRoot(api)
            .ConfigureLogging(logging => logging.ClearProviders())
            .ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string,string?> { ["SENX_DB_CONNECTION"]=connection, ["Jwt:Key"]=new string('q',40), ["Development:AllowAnonymousCrud"]=anonymous.ToString() }));
    }
}

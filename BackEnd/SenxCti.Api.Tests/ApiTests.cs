using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using SenxCti.Api.Auth;

namespace SenxCti.Api.Tests;

public sealed class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;
    public ApiTests(WebApplicationFactory<Program> factory) =>
        client = factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(new Dictionary<string,string?> { ["SENX_DB_CONNECTION"] = "" }))).CreateClient();

    public static async Task<HttpResponseMessage> Post(HttpClient client,string path,object body)
    {
        var csrf=await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        client.DefaultRequestHeaders.Remove("X-CSRF-Token");
        client.DefaultRequestHeaders.Add("X-CSRF-Token",csrf.GetProperty("token").GetString());
        return await client.PostAsJsonAsync(path,body);
    }

    [Theory]
    [InlineData("/gerenciador/")]
    [InlineData("/gerenciador/app.js")]
    [InlineData("/Documentacao/Ferramentas/Diagnostico/index.html")]
    public async Task Diagnostics_AreNotPublishedByTheMainApi(string path) =>
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync(path)).StatusCode);

    [Theory]
    [InlineData("/api/data/snapshot")]
    [InlineData("/api/auth/session")]
    [InlineData("/api/database/health")]
    public async Task ProtectedData_RequiresLogin(string path) =>
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync(path)).StatusCode);

    [Theory]
    [InlineData("/api/data/teams")]
    [InlineData("/api/data/criteria")]
    [InlineData("/api/data/users")]
    public async Task AnonymousWrites_AreRejected(string path) =>
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.PostAsJsonAsync(path,new {})).StatusCode);

    [Fact]
    public async Task Login_RequiresCsrfEvenBeforeAuthentication() =>
        Assert.Equal(HttpStatusCode.Forbidden,(await client.PostAsJsonAsync("/api/auth/login",new { email="a@example.test",password="invalid" })).StatusCode);

    [Fact]
    public async Task Login_RejectsInvalidInput_BeforeDatabaseAccess()
    {
        var response=await Post(client,"/api/auth/login",new { email="invalid",password="" });
        Assert.Equal(HttpStatusCode.BadRequest,response.StatusCode);
    }

    [Fact]
    public async Task Login_RateLimit_Returns429()
    {
        await using var factory=new WebApplicationFactory<Program>();
        using var isolated=factory.CreateClient();
        HttpResponseMessage? response=null;
        for(var i=0;i<11;i++) response=await Post(isolated,"/api/auth/login",new { email="invalid",password="" });
        Assert.Equal(HttpStatusCode.TooManyRequests,response!.StatusCode);
    }

    [Fact]
    public async Task Setup_DatabaseFailure_ReturnsSanitizedError()
    {
        var response=await client.GetAsync("/api/auth/status");
        Assert.Equal(HttpStatusCode.ServiceUnavailable,response.StatusCode);
        var body=await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Password=",body);
        Assert.DoesNotContain("StackTrace",body);
    }

    [Fact]
    public async Task Frontend_IsServedFromCanonicalSource()
    {
        Assert.Contains("SENX — Plataforma CTI",await client.GetStringAsync("/"));
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/session.js")).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/assets/Inter-variable.ttf")).StatusCode);
        Assert.Contains("OFL",await client.GetStringAsync("/assets/Inter-OFL.txt"));
        var health=await client.GetFromJsonAsync<JsonElement>("/api/health");
        Assert.Equal("0.1.4.2",health.GetProperty("version").GetString());
    }

    [Fact]
    public async Task Production_DoesNotPublishLocalDataRoutes()
    {
        await using var factory=new WebApplicationFactory<Program>();
        using var production=factory.WithWebHostBuilder(b=>b.UseEnvironment("Production")).CreateClient();
        Assert.Equal(HttpStatusCode.NotFound,(await production.GetAsync("/api/data/snapshot")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await production.GetAsync("/gerenciador/")).StatusCode);
    }

    [Fact]
    public void Passwords_AreSaltedAndVerifiedByThePlatform()
    {
        var hasher=new PasswordHasher<UserAccount>();
        var user=new UserAccount(Guid.NewGuid(),"QA","qa@example.test","QA","Colaborador",Guid.NewGuid(),"QA");
        var password=Guid.NewGuid().ToString();
        var first=hasher.HashPassword(user,password);
        Assert.NotEqual(password,first);
        Assert.NotEqual(first,hasher.HashPassword(user,password));
        Assert.Equal(PasswordVerificationResult.Success,hasher.VerifyHashedPassword(user,first,password));
        Assert.Equal(PasswordVerificationResult.Failed,hasher.VerifyHashedPassword(user,first,password+"wrong"));
    }

    [Theory]
    [InlineData("Administrador",true)]
    [InlineData("Colaborador",true)]
    [InlineData("SuperAdmin",false)]
    public void UserInput_RestrictsProfiles(string profile,bool expected) =>
        Assert.Equal(expected,AuthRepository.ValidUser(new("QA","qa@example.test",new string('a',12),Guid.NewGuid(),"QA",profile)));

    [Theory]
    [InlineData("Nome","qa@example.test","atual","",true)]
    [InlineData("Nome","qa@example.test","atual",null,true)]
    [InlineData("Nome","qa@example.test","atual","123456789012",true)]
    [InlineData(" ","qa@example.test","atual",null,false)]
    [InlineData("Nome","inválido","atual",null,false)]
    [InlineData("Nome","qa@example.test","",null,false)]
    [InlineData("Nome","qa@example.test","atual","curta",false)]
    public void ProfileInput_RequiresIdentityAndValidFields(string name,string email,string current,string? password,bool expected) =>
        Assert.Equal(expected,AuthRepository.ValidProfile(new(name,email,current,password)));

    [Fact]
    public void CredentialVersion_IsNotSerialized()
    {
        var user=new UserAccount(Guid.NewGuid(),"QA","qa@example.test","QA","Colaborador",Guid.NewGuid(),"QA")
            { CredentialVersion="private-version" };
        Assert.DoesNotContain("private-version",JsonSerializer.Serialize(user));
        Assert.Equal("private-version",AuthRepository.Principal(user).FindFirst("credentialVersion")!.Value);
    }

    [Fact]
    public async Task ProfileUpdate_RequiresAuthentication() =>
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.PutAsJsonAsync("/api/auth/profile",new {})).StatusCode);
}

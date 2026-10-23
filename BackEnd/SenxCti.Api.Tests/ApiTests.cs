using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;

namespace SenxCti.Api.Tests;

public sealed class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    public ApiTests(WebApplicationFactory<Program> factory) =>
        _client = factory.WithWebHostBuilder(builder => builder.UseSetting("SENX_DB_CONNECTION", "")).CreateClient();

    [Fact]
    public async Task Manager_IsAvailableInDevelopment_WithRestrictedFiles()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development")).CreateClient();
        var response = await client.GetAsync("/gerenciador/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("Gerenciador de recursos", await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/gerenciador/app.js")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/gerenciador/tools/preview.mjs")).StatusCode);
    }

    [Fact]
    public async Task Manager_IsNotPublishedInProduction()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Production")).CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/gerenciador/")).StatusCode);
    }

    [Fact]
    public async Task Frontend_IsServedFromCanonicalSource()
    {
        var response = await _client.GetAsync("/");
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("SENX — Plataforma CTI", body);
        var dataResponse = await _client.GetAsync("/data.js");
        Assert.Equal(HttpStatusCode.OK, dataResponse.StatusCode);
    }

    [Fact]
    public async Task Health_ReturnsFakeProvider()
    {
        var response = await _client.GetAsync("/api/health");
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"aiProvider\":\"fake\"", body);
    }

    [Fact]
    public async Task Analyze_RejectsEmptyTranscript()
    {
        var response = await _client.PostAsJsonAsync("/api/ai/analyze", new { transcript = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Analyze_ReturnsLocalShape()
    {
        var response = await _client.PostAsJsonAsync("/api/ai/analyze", new { transcript = "Cliente pediu revisão da cobrança." });
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"provider\":\"fake\"", body);
        Assert.Contains("Resumo simulado", body);
    }

    [Fact]
    public async Task DatabaseHealth_WithoutConfiguration_ReturnsServiceUnavailable()
    {
        var response = await _client.GetAsync("/api/database/health");
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("not_configured", body);
    }
}

using System.Text.Json;
using System.Text.RegularExpressions;

namespace TranscribeTest;

public sealed record SavedRecording(string Id, string Folder, string? FileName = null)
{
    public string DownloadUrl => $"/api/recordings/{Id}/audio";
}

public sealed class RecordingStore(IWebHostEnvironment environment, IConfiguration configuration)
{
    private readonly string root = Path.GetFullPath(configuration["Recordings:Directory"] ?? "Gravacoes",
        environment.ContentRootPath);
    private readonly SemaphoreSlim gate = new(1, 1);

    public SavedRecording Create()
    {
        var id = DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N");
        var folder = Path.Combine(root, id);
        Directory.CreateDirectory(folder);
        return new(id, folder);
    }

    public string GetFolder(string id)
    {
        if (!Regex.IsMatch(id, @"\A\d{8}-\d{6}-[a-f0-9]{32}\z"))
            throw new ArgumentException("Identificador de gravação inválido.");
        var folder = Path.Combine(root, id);
        if (!Directory.Exists(folder)) throw new DirectoryNotFoundException("Gravação não encontrada.");
        return folder;
    }

    public async Task<SavedRecording> SaveAsync(IFormFile file, string? id, CancellationToken ct)
    {
        var saved = id is null ? Create() : new SavedRecording(id, GetFolder(id));
        var extension = Path.GetExtension(Path.GetFileName(file.FileName)).ToLowerInvariant();
        if (!Regex.IsMatch(extension, @"\A\.[a-z0-9]{1,8}\z")) extension = ".bin";
        var name = "audio" + extension;
        var temp = Path.Combine(saved.Folder, Guid.NewGuid().ToString("N") + ".tmp");
        await gate.WaitAsync(ct);
        try
        {
            await using (var output = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                81920, FileOptions.Asynchronous))
                await file.CopyToAsync(output, ct);
            File.Move(temp, Path.Combine(saved.Folder, name), overwrite: true);
            await File.WriteAllTextAsync(Path.Combine(saved.Folder, "gravacao.json"),
                JsonSerializer.Serialize(new { originalName = Path.GetFileName(file.FileName), fileName = name,
                    bytes = file.Length, savedAt = DateTimeOffset.Now }), ct);
            return saved with { FileName = name };
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
            gate.Release();
        }
    }

    public string GetAudioPath(string id)
    {
        var folder = GetFolder(id);
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(folder, "gravacao.json")));
        return Path.Combine(folder, Path.GetFileName(doc.RootElement.GetProperty("fileName").GetString()!));
    }
}

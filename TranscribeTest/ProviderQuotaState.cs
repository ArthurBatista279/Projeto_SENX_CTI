using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace TranscribeTest;

// Compartilhado entre requisições e sessões, sem persistir credenciais ou respostas de áudio.
public sealed class ProviderQuotaState(TimeProvider? timeProvider = null)
{
    private readonly TimeProvider clock = timeProvider ?? TimeProvider.System;
    private readonly ConcurrentDictionary<string, DateTimeOffset> blockedUntil = new();

    private static string Id(string provider, string key)
    {
        var family = provider.StartsWith("Nvidia", StringComparison.Ordinal) ? "Nvidia"
            : provider.StartsWith("Groq", StringComparison.Ordinal) ? "Groq"
            : provider.StartsWith("Deepgram", StringComparison.Ordinal) ? "Deepgram" : provider;
        return family + ":" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
    }

    public TimeSpan Remaining(string provider, string key)
    {
        if (!blockedUntil.TryGetValue(Id(provider, key), out var until)) return TimeSpan.Zero;
        var remaining = until - clock.GetUtcNow();
        return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
    }

    public void Block(string provider, string key, TimeSpan duration)
    {
        var until = clock.GetUtcNow().Add(duration > TimeSpan.Zero ? duration : TimeSpan.FromSeconds(1));
        blockedUntil.AddOrUpdate(Id(provider, key), until, (_, current) => current > until ? current : until);
    }
}

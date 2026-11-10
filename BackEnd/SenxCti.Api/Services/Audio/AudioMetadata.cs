namespace SenxCti.Api.Services.Audio;

public static class AudioMetadata
{
    public static TimeSpan ReadDuration(string path)
    {
        using var audio = TagLib.File.Create(path, TagLib.ReadStyle.Average);
        var duration = audio.Properties.Duration;
        if (duration <= TimeSpan.Zero || duration >= TimeSpan.FromDays(1))
            throw new InvalidDataException("Duração do áudio inválida ou superior ao limite de 24 horas.");
        return duration;
    }
}

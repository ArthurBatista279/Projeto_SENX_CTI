namespace TranscribeTest;

public sealed class UploadLimits
{
    public const int MinimumLimitMb = 500;
    public const int MaximumLimitMb = 2048;
    public int MaxFileSizeMb { get; }
    public long MaxFileSizeBytes => MaxFileSizeMb * 1024L * 1024;
    // O envelope multipart também ocupa bytes, além do arquivo.
    public long MaxRequestBodyBytes => MaxFileSizeBytes + 1024L * 1024;

    public UploadLimits(int maxFileSizeMb = MaximumLimitMb)
    {
        if (maxFileSizeMb is < MinimumLimitMb or > MaximumLimitMb)
            throw new ArgumentOutOfRangeException(nameof(maxFileSizeMb), "Uploads:MaxFileSizeMb deve estar entre 500 e 2048.");
        MaxFileSizeMb = maxFileSizeMb;
    }

    public bool Accepts(long length) => length > 0 && length <= MaxFileSizeBytes;
}

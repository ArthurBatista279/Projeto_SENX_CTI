using System.Security.Claims;
using System.Security.Cryptography;
using Npgsql;
using SenxCti.Api.Database;
using SenxCti.Api.Services.Ai;

namespace SenxCti.Api.Services.Audio;

public sealed class AudioIngestion(DatabaseConnection database, IAiAnalysisService ai, IConfiguration config, ILogger<AudioIngestion> logger)
{
    public static bool ValidHeader(string extension, ReadOnlySpan<byte> bytes) => extension switch
    {
        ".wav" => bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes.Slice(8, 4).SequenceEqual("WAVE"u8),
        ".ogg" => bytes.Length >= 4 && bytes[..4].SequenceEqual("OggS"u8),
        ".mp3" => bytes.Length >= 3 && (bytes[..3].SequenceEqual("ID3"u8) || bytes[0] == 0xff && (bytes[1] & 0xe0) == 0xe0),
        ".m4a" => bytes.Length >= 12 && bytes.Slice(4, 4).SequenceEqual("ftyp"u8),
        _ => false
    };

    public async Task<IResult> Process(Stream source, string originalName, AudioCallInput input, ClaimsPrincipal principal, CancellationToken ct)
    {
        if (!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var actor)) return Results.Unauthorized();
        var admin = principal.IsInRole("Administrador");
        static bool Phone(string? value) => value is { Length: >= 1 and <= 11 } && value.All(char.IsAsciiDigit);
        if (input.IdFuncionario == Guid.Empty || input.IdCliente == Guid.Empty || !Phone(input.NumeroOrigem) || !Phone(input.NumeroDestino) || input.Direcao is not ("Entrada" or "Saída"))
            return Results.Problem("Confira atendente, cliente, números (até 11 dígitos) e direção (Entrada/Saída).", statusCode: 400);
        if (!admin && input.IdFuncionario != actor) return Results.Forbid();
        var root = config["SENX_AUDIO_ROOT"];
        if (string.IsNullOrWhiteSpace(root) || !Path.IsPathFullyQualified(root))
            return Results.Problem("Configure SENX_AUDIO_ROOT com uma pasta absoluta para os áudios.", statusCode: 503);
        root = Path.GetFullPath(root);
        try
        {
            Directory.CreateDirectory(root);
            for (DirectoryInfo? dir = new(root); dir is not null; dir = dir.Parent)
                if ((dir.Attributes & FileAttributes.ReparsePoint) != 0) return Results.Problem("A pasta de áudio não pode usar links simbólicos.", statusCode: 503);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        { return Results.Problem("A pasta de áudio não está disponível para gravação.", statusCode: 503); }
        await using (var validationConnection = await database.OpenAsync(ct))
        await using (var check = new NpgsqlCommand("""
            SELECT EXISTS(SELECT 1 FROM public."Usuario" WHERE "IdUsuario"=@user AND "Ativo")
            AND EXISTS(SELECT 1 FROM public."DadosCliente" WHERE "IdDadosCliente"=@customer)
            """, validationConnection))
        {
            check.Parameters.AddWithValue("user", input.IdFuncionario); check.Parameters.AddWithValue("customer", input.IdCliente);
            if (await check.ExecuteScalarAsync(ct) is not true) return Results.Problem("Atendente ou cliente não disponível para esta conta.", statusCode: 400);
        }
        var extension = Path.GetExtension(originalName).ToLowerInvariant();
        var header = new byte[12];
        var read = await source.ReadAtLeastAsync(header, header.Length, false, ct);
        if (!ValidHeader(extension, header.AsSpan(0, read))) return Results.Problem("Formato inválido. Use WAV, MP3, OGG ou M4A.", statusCode: 415);
        var call = Guid.NewGuid(); var analysis = Guid.NewGuid();
        var filename = call.ToString("N") + extension;
        var path = Path.Combine(root, filename);
        var ownsFile = false;
        var created = false;
        try
        {
            await using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                ownsFile = true;
                await output.WriteAsync(header.AsMemory(0, read), ct);
                var buffer = new byte[81920]; long total = read;
                int count;
                while ((count = await source.ReadAsync(buffer, ct)) != 0)
                {
                    total += count;
                    if (total > AudioEndpoints.MaxBytes) return Results.Problem("Áudio excede 20 MiB.", statusCode: 413);
                    await output.WriteAsync(buffer.AsMemory(0, count), ct);
                }
            }
            TimeSpan duration;
            try { duration = AudioMetadata.ReadDuration(path); }
            catch (Exception error) when (error is TagLib.CorruptFileException or TagLib.UnsupportedFormatException or InvalidDataException)
            { return Results.Problem("Não foi possível ler a duração do áudio. Verifique se o arquivo está completo e em um formato permitido.", statusCode: 422); }
            string hash;
            await using (var audio = File.OpenRead(path)) hash = Convert.ToHexString(await SHA256.HashDataAsync(audio, ct)).ToLowerInvariant();
            // Only persist a call after processing succeeds; all database writes commit together.
            var result = await ai.ProcessAudioAsync(path, ct);
            await using var connection = await database.OpenAsync(ct);
            await using var tx = await connection.BeginTransactionAsync(ct);
            await using (var insert = new NpgsqlCommand("""
                INSERT INTO public."Ligacao" ("IdLigacao","IdFuncionario","IdCliente","Duracao","Numero_Origem","Numero_Destino","Stats","Hash_Audio","Caminho_Arquivo","IdentificadorPABX","Direcao")
                VALUES (@id,@user,@customer,@duration,@origin,@destination,'Processada',@hash,@file,'Upload SENX',@direction)
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("id", call); insert.Parameters.AddWithValue("user", input.IdFuncionario); insert.Parameters.AddWithValue("customer", input.IdCliente);
                insert.Parameters.AddWithValue("duration", NpgsqlTypes.NpgsqlDbType.Time, duration);
                insert.Parameters.AddWithValue("origin", input.NumeroOrigem); insert.Parameters.AddWithValue("destination", input.NumeroDestino);
                insert.Parameters.AddWithValue("hash", hash); insert.Parameters.AddWithValue("file", filename); insert.Parameters.AddWithValue("direction", input.Direcao);
                await insert.ExecuteNonQueryAsync(ct);
            }
            await using (var insert = new NpgsqlCommand("""
                INSERT INTO public."Analise" ("IdAnalise","IdLigacao","ResolucaoEncaminhamento","StatusProcessamento","Modelo_Versao","Transcricao_Texto","Resumo_Texto","Cancelamento","Oportunidade","ScoreGeral","ProblemaNecessidade","Compromissos")
                VALUES (@analysis,@id,@resolution,true,@model,@transcript,@summary,@cancel,@opportunity,@score,@problem,@commitments);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("analysis", analysis); insert.Parameters.AddWithValue("id", call);
                insert.Parameters.AddWithValue("resolution", result.ResolucaoEncaminhamento); insert.Parameters.AddWithValue("model", result.ModeloVersao);
                insert.Parameters.AddWithValue("transcript", result.TranscricaoTexto); insert.Parameters.AddWithValue("summary", result.ResumoTexto);
                insert.Parameters.AddWithValue("cancel", result.Cancelamento); insert.Parameters.AddWithValue("opportunity", result.Oportunidade);
                insert.Parameters.AddWithValue("score", result.ScoreGeral); insert.Parameters.AddWithValue("problem", result.ProblemaNecessidade);
                insert.Parameters.AddWithValue("commitments", result.Compromissos);
                await insert.ExecuteNonQueryAsync(ct);
            }
            foreach (var criterion in result.Resultados)
            {
                await using var score = new NpgsqlCommand("""
                    INSERT INTO public."Resultado" ("IdCriterio","IdAnalise","IdFuncionario","Classificacao","Score","Justificativa","TrechoEvidencia","ResultadoValidado","StatusValidacao","ObservacaoValidacao")
                    VALUES (@criterion,@analysis,@user,'Avaliação automática',@score,@reason,'','Não revisado','Pendente','Revisão humana ainda não realizada')
                    """, connection, tx);
                score.Parameters.AddWithValue("criterion", criterion.IdCriterio); score.Parameters.AddWithValue("analysis", analysis);
                score.Parameters.AddWithValue("user", input.IdFuncionario); score.Parameters.AddWithValue("score", criterion.Score);
                score.Parameters.AddWithValue("reason", criterion.Justificativa);
                await score.ExecuteNonQueryAsync(ct);
            }
            await tx.CommitAsync(ct);
            created = true;
            return Results.Created($"/api/data/calls/{call}", new { id = call, analysisId = analysis, status = "Processada", simulated = result.Simulada, model = result.ModeloVersao });
        }
        catch (Exception error) when (error is not OutOfMemoryException)
        {
            logger.LogWarning("Processamento de áudio {CallId} falhou: {ErrorType}", call, error.GetType().Name);
            if (error is OperationCanceledException && ct.IsCancellationRequested) throw;
            return Results.Problem(error is AiProcessingException ? error.Message : "Não foi possível processar o áudio. Confira a configuração da IA e tente novamente.", statusCode: 503, extensions: new Dictionary<string, object?> { ["id"] = created ? call : null });
        }
        finally
        {
            if (ownsFile && !created)
            {
                try { File.Delete(path); }
                catch (Exception error) when (error is IOException or UnauthorizedAccessException)
                { logger.LogWarning("Falha na limpeza do arquivo de áudio {CallId}: {ErrorType}", call, error.GetType().Name); }
            }
        }
    }
}

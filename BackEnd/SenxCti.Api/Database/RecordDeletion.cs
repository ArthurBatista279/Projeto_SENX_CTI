using Npgsql;

namespace SenxCti.Api.Database;

public sealed class RecordDeletion(DatabaseConnection database, IConfiguration configuration, ILogger<RecordDeletion> logger)
{
    private static readonly IReadOnlyDictionary<string, (string Table, string Key)> Resources =
        new Dictionary<string, (string, string)> {
            ["calls"] = ("Ligacao", "IdLigacao"), ["reports"] = ("Relatorio", "IdRelatorio"),
            ["criteria"] = ("Criterio", "IdCriterio"), ["customers"] = ("DadosCliente", "IdDadosCliente"),
            ["users"] = ("Usuario", "IdUsuario"), ["teams"] = ("Equipe", "IdEquipe")
        };

    public async Task<int> Delete(string resource, Guid id, Guid actor, CancellationToken ct)
    {
        if (!Resources.TryGetValue(resource, out var target)) return 404;
        if (resource == "users" && id == actor) return 409;
        await using var connection = await database.OpenAsync(ct);
        string? audio = null;
        try
        {
            await using var tx = await connection.BeginTransactionAsync(ct);
            // Identifiers come exclusively from the allowlist above; values are parameters.
            await using (var row = new NpgsqlCommand($"SELECT \"{target.Key}\" FROM public.\"{target.Table}\" WHERE \"{target.Key}\"=@id FOR UPDATE", connection, tx))
            {
                row.Parameters.AddWithValue("id", id);
                if (await row.ExecuteScalarAsync(ct) is null) return 404;
            }
            if (resource == "calls")
            {
                await using var file = new NpgsqlCommand("""SELECT "Caminho_Arquivo" FROM public."Ligacao" WHERE "IdLigacao"=@id""", connection, tx);
                file.Parameters.AddWithValue("id", id);
                audio = (string?)await file.ExecuteScalarAsync(ct);
                await using var children = new NpgsqlCommand("""
                    DELETE FROM public."RevisaoHumana" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id);
                    DELETE FROM public."Resultado" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id);
                    DELETE FROM public."Registro" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id);
                    DELETE FROM public."Alerta" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id);
                    DELETE FROM public."Analise" WHERE "IdLigacao"=@id;
                    DELETE FROM public."LigacaoAssunto" WHERE "IdLigacao"=@id;
                    """, connection, tx);
                children.Parameters.AddWithValue("id", id);
                await children.ExecuteNonQueryAsync(ct);
            }
            await using var delete = new NpgsqlCommand($"DELETE FROM public.\"{target.Table}\" WHERE \"{target.Key}\"=@id", connection, tx);
            delete.Parameters.AddWithValue("id", id);
            await delete.ExecuteNonQueryAsync(ct);
            if (!string.IsNullOrEmpty(audio))
            {
                await using var shared = new NpgsqlCommand("""SELECT EXISTS(SELECT 1 FROM public."Ligacao" WHERE "Caminho_Arquivo"=@file)""", connection, tx);
                shared.Parameters.AddWithValue("file", audio);
                if (await shared.ExecuteScalarAsync(ct) is true) audio = null;
            }
            await tx.CommitAsync(ct);
        }
        catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        { return 409; }

        var path = DeliveryRepository.ResolveAudio(configuration["SENX_AUDIO_ROOT"], audio);
        if (path is not null)
        {
            try { File.Delete(path); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            { logger.LogWarning("Registro {Id} excluído; limpeza do arquivo de áudio pendente ({Kind}).", id, error.GetType().Name); }
        }
        return 204;
    }
}

using Npgsql;

namespace SenxCti.Api.Database;

public sealed record DeletionResult(int Status, string Detail)
{
    public IResult ToHttp() => Status == 204 ? Results.NoContent() : Results.Problem(Detail,statusCode:Status);
}

public class CadastroDeletion(DatabaseConnection database, IConfiguration configuration, ILogger<CadastroDeletion> logger)
{
    public virtual async Task<DeletionResult> Delete(bool user, Guid id, Guid actor, CancellationToken token)
    {
        if (id == Guid.Empty) return new(400,"Identificador inválido.");
        if (user && id == actor) return new(409,"Não é possível excluir sua própria conta.");
        await using var connection = await database.OpenAsync(token);
        await using var tx = await connection.BeginTransactionAsync(token);
        var table = user ? "Usuario" : "DadosCliente";
        var key = user ? "IdUsuario" : "IdDadosCliente";
        var state = user ? "\"Ativo\"" : "\"Situacao\"";
        await using (var find = new NpgsqlCommand($"SELECT {state} FROM public.\"{table}\" WHERE \"{key}\"=@id FOR UPDATE",connection,tx))
        {
            find.Parameters.AddWithValue("id",id);
            var value = await find.ExecuteScalarAsync(token);
            if (value is null) return new(404,"Cadastro não encontrado.");
            var inactive = user ? value is false : string.Equals(value as string,"Inativo",StringComparison.OrdinalIgnoreCase);
            if (!inactive) return new(409,"Desative o cadastro antes de excluir.");
        }
        var references = user ? """
            SELECT EXISTS(SELECT 1 FROM public."Ligacao" WHERE "IdFuncionario"=@id)
            OR EXISTS(SELECT 1 FROM public."DadosCliente" WHERE "IdUsuario"=@id)
            OR EXISTS(SELECT 1 FROM public."Alerta" WHERE "IdFuncionario"=@id)
            OR EXISTS(SELECT 1 FROM public."Registro" WHERE "IdFuncionario"=@id)
            OR EXISTS(SELECT 1 FROM public."Resultado" WHERE "IdFuncionario"=@id)
            OR EXISTS(SELECT 1 FROM public."RevisaoHumana" WHERE "IdRevisor"=@id)
            OR EXISTS(SELECT 1 FROM public."Relatorio" WHERE "IdAutor"=@id)
            """ : """SELECT EXISTS(SELECT 1 FROM public."Ligacao" WHERE "IdCliente"=@id)""";
        await using (var check = new NpgsqlCommand(references,connection,tx))
        {
            check.Parameters.AddWithValue("id",id);
            if (await check.ExecuteScalarAsync(token) is true)
                return new(409,"Este cadastro possui vínculos com o histórico. Mantenha-o inativo; nenhum registro relacionado será apagado.");
        }
        try
        {
            await using var remove = new NpgsqlCommand($"DELETE FROM public.\"{table}\" WHERE \"{key}\"=@id",connection,tx);
            remove.Parameters.AddWithValue("id",id);
            await remove.ExecuteNonQueryAsync(token);
            await tx.CommitAsync(token);
            return new(204,"");
        }
        catch (PostgresException error) when (error.SqlState == "23503")
        { return new(409,"O cadastro possui registros vinculados e não pode ser excluído."); }
    }

    public async Task<DeletionResult> DeleteRecord(string resource, Guid id, CancellationToken token)
    {
        if (id == Guid.Empty) return new(400, "Identificador inválido.");
        if (resource == "calls") return await DeleteCall(id, token);
        var sql = resource switch
        {
            "criteria" => """DELETE FROM public."Criterio" WHERE "IdCriterio"=@id""",
            "teams" => """DELETE FROM public."Equipe" WHERE "IdEquipe"=@id""",
            _ => null
        };
        if (sql is null) return new(404, "Registro não encontrado.");

        await using var connection = await database.OpenAsync(token);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        try
        {
            return await command.ExecuteNonQueryAsync(token) == 0
                ? new(404, "Registro não encontrado.")
                : new(204, "");
        }
        catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            return new(409, "Este registro tem vínculos com o histórico. Nenhum dado relacionado foi excluído.");
        }
    }

    private async Task<DeletionResult> DeleteCall(Guid id, CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        string? stored;
        try
        {
            await using var tx = await connection.BeginTransactionAsync(token);
            await using var find = new NpgsqlCommand("""
                SELECT COALESCE("Caminho_Arquivo", '') FROM public."Ligacao" WHERE "IdLigacao"=@id FOR UPDATE
                """, connection, tx);
            find.Parameters.AddWithValue("id", id);
            stored = (string?)await find.ExecuteScalarAsync(token);
            if (stored is null) return new(404, "Ligação não encontrada.");

            await using var remove = new NpgsqlCommand("""
                DELETE FROM public."RevisaoHumana" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id);
                DELETE FROM public."Resultado" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id);
                DELETE FROM public."Registro" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id);
                DELETE FROM public."Alerta" WHERE "IdAnalise" IN (SELECT "IdAnalise" FROM public."Analise" WHERE "IdLigacao"=@id);
                DELETE FROM public."Analise" WHERE "IdLigacao"=@id;
                DELETE FROM public."LigacaoAssunto" WHERE "IdLigacao"=@id;
                DELETE FROM public."Ligacao" WHERE "IdLigacao"=@id;
                """, connection, tx);
            remove.Parameters.AddWithValue("id", id);
            await remove.ExecuteNonQueryAsync(token);
            await tx.CommitAsync(token);
        }
        catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            return new(409, "A ligação ainda tem vínculos. Nenhum registro foi excluído.");
        }

        await DeleteUnsharedAudio(connection, stored, id);
        return new(204, "");
    }

    private async Task DeleteUnsharedAudio(NpgsqlConnection connection, string? stored, Guid id)
    {
        var root = configuration["SENX_AUDIO_ROOT"];
        var path = DeliveryRepository.ResolveAudio(root, stored);
        if (path is null) return;
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var token = timeout.Token;
        try
        {
            // Hold off new references until the post-commit file cleanup is finished.
            await using var tx = await connection.BeginTransactionAsync(token);
            await using var gate = new NpgsqlCommand("""LOCK TABLE public."Ligacao" IN SHARE MODE""", connection, tx);
            await gate.ExecuteNonQueryAsync(token);
            await using var check = new NpgsqlCommand("""
                SELECT DISTINCT "Caminho_Arquivo" FROM public."Ligacao" WHERE NULLIF("Caminho_Arquivo",'') IS NOT NULL
                """, connection, tx);
            await using (var reader = await check.ExecuteReaderAsync(token))
            {
                while (await reader.ReadAsync(token))
                    if (string.Equals(path, DeliveryRepository.ResolveAudio(root, reader.GetString(0)), comparison))
                        return;
            }
            File.Delete(path);
            await tx.CommitAsync(token);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or NpgsqlException or OperationCanceledException or TimeoutException)
        {
            logger.LogWarning("Ligação {Id} excluída, mas a limpeza do áudio não pôde ser confirmada ({Kind}).", id, error.GetType().Name);
        }
    }
}

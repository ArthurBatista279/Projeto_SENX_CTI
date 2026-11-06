using Npgsql;

namespace SenxCti.Api.Database;

public sealed record DeletionResult(int Status, string Detail)
{
    public IResult ToHttp() => Status == 204 ? Results.NoContent() : Results.Problem(Detail,statusCode:Status);
}

public class CadastroDeletion(DatabaseConnection database)
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
}

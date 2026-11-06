using SenxCti.Api.Database;

// Substitui SQL na suite legada de controllers; nao representa politica de producao.
internal sealed class IsolatedDeletion(Dictionary<string,RepositoryDouble> repositories) : CadastroDeletion(null!)
{
    public override Task<DeletionResult> Delete(bool user,Guid id,Guid actor,CancellationToken token)
    {
        if (id==Guid.Empty) return Task.FromResult(new DeletionResult(400,"ID vazio"));
        var found=repositories[user ? "Usuario" : "DadosCliente"].Rows.TryRemove(id,out _);
        return Task.FromResult(new DeletionResult(found ? 204 : 404,""));
    }
}

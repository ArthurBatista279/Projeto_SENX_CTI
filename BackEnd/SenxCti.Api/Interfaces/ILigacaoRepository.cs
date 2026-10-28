using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface ILigacaoRepository
{
    Ligacao BuscarPorId(Guid Id);
    List<Ligacao> Listar();
    void Cadastrar(Ligacao novaLigacao);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Ligacao ligacaoAtualizada);
    void AtualizarIdUrl(Guid Id, Ligacao ligacaoAtualizada);
}

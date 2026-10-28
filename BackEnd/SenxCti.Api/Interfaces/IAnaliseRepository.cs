using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface IAnaliseRepository
{
    Analise BuscarPorId(Guid Id);
    List<Analise> Listar();
    void Cadastrar(Analise novaAnalise);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Analise analiseAtualizada);
    void AtualizarIdUrl(Guid Id, Analise novaAnalise);
}

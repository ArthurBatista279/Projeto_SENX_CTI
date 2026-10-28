using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface ICriterioRepository
{
    Criterio BuscarPorId(Guid Id);
    List<Criterio> Listar();
    void Cadastrar(Criterio novoCriterio);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Criterio criterioAtualizado);
    void AtualizarIdUrl(Guid Id, Criterio criterioAtualizado);
}

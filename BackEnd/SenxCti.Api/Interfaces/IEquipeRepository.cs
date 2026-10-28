using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface IEquipeRepository
{
    Equipe BuscarPorId(Guid Id);
    List<Equipe> Listar();
    void Cadastrar(Equipe equipe);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Equipe equipeAtualizada);
    void AtualizarIdUrl(Guid Id, Equipe equipeAtualizada);
}

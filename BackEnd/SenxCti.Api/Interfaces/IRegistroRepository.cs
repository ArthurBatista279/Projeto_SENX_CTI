using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface IRegistroRepository
{
    Registro BuscarPorId(Guid Id);
    List<Registro> Listar();
    void Cadastrar(Registro registro);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Registro registroAtualizado);
    void AtualizarIdUrl(Guid Id, Registro registroAtualizado);
}

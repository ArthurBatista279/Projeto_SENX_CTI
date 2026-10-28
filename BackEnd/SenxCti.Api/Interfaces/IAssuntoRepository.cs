using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface IAssuntoRepository
{
    Assunto BuscarPorId(Guid Id);
    List<Assunto> Listar();
    void Cadastrar(Assunto novoAssunto);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Assunto assuntoAtualizado);
    void AtualizarIdUrl(Guid Id, Assunto assuntoAtualizado);
}

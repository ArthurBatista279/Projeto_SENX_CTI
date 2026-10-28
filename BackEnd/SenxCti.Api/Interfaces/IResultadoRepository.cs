using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface IResultadoRepository
{
    Resultado BuscarPorId(Guid Id);
    List<Resultado> Listar();
    void Cadastrar(Resultado novoResultado);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Resultado resultadoAtualizado);
    void AtualizarIdUrl(Guid Id, Resultado resultadoAtualizado);
}

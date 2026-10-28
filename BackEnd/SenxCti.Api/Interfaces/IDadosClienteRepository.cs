using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface IDadosClienteRepository
{
    DadosCliente BuscarPorId(Guid Id);
    List<DadosCliente> Listar();
    void Cadastrar(DadosCliente novoDadosCliente);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(DadosCliente dadosClienteAtualizado);
    void AtualizarIdUrl(Guid Id, DadosCliente dadosClienteAtualizado);
}

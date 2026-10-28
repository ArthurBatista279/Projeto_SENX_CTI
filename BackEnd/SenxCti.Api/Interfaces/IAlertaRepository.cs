using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface IAlertaRepository
{
    Alerta BuscarPorId(Guid Id);
    List<Alerta> Listar();
    void Cadastrar(Alerta novoAlerta);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Alerta alertaAtualizado);
    void AtualizarIdUrl(Guid Id, Alerta alertaAtualizado);
}

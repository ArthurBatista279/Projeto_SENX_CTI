using SenxCti.Api.Models;

namespace SenxCti.Api.Interfaces;

public interface IUsuarioRepository
{
    Usuario? BuscarPorId(Guid Id);
    List<Usuario> Listar();
    Usuario Cadastrar(Usuario novoUsuario);
    void Deletar(Guid Id);
    void AtualizarIdCorpo(Usuario usuarioAtualizado);
    void AtualizarIdUrl(Guid Id, Usuario usuarioAtualizado);
}

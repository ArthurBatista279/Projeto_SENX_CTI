using Microsoft.AspNetCore.Identity;
using SenxCti.Api.Auth;
using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class UsuarioRepository(SenxContext context, IPasswordHasher<UserAccount> hasher) : IUsuarioRepository
{
    public Usuario? BuscarPorId(Guid id) => context.Usuario.Find(id);
    public List<Usuario> Listar() => context.Usuario.ToList();

    private string Hash(Usuario user) => hasher.HashPassword(new(user.IdUsuario, user.Nome,
        user.Email, user.Cargo, user.Perfil, user.IdEquipe, ""), user.Senha);

    public Usuario Cadastrar(Usuario novoUsuario)
    {
        novoUsuario.IdUsuario = Guid.NewGuid();
        novoUsuario.Senha = Hash(novoUsuario);
        context.Usuario.Add(novoUsuario);
        context.SaveChanges();
        return novoUsuario;
    }

    public void AtualizarIdCorpo(Usuario usuarioAtualizado) =>
        AtualizarIdUrl(usuarioAtualizado.IdUsuario, usuarioAtualizado);

    public void AtualizarIdUrl(Guid id, Usuario input)
    {
        var user = BuscarPorId(id);
        if (user is null) return;
        var hash = Hash(input);
        user.IdEquipe = input.IdEquipe;
        user.Nome = input.Nome;
        user.Email = input.Email;
        user.Imagem = input.Imagem;
        user.Cargo = input.Cargo;
        user.Perfil = input.Perfil;
        user.Senha = hash;
        context.SaveChanges();
    }

    public void Deletar(Guid id)
    {
        var user = BuscarPorId(id);
        if (user is null) return;
        context.Usuario.Remove(user);
        context.SaveChanges();
    }
}

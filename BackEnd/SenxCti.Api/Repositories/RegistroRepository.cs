using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class RegistroRepository : IRegistroRepository
{
    private readonly SenxContext _context;
    public RegistroRepository(SenxContext context)
    {
        _context = context;
    }

    public void AtualizarIdCorpo(Registro registroAtualizado)
    {
        try
        {
            Registro registroBuscado = _context.Registro.Find(registroAtualizado.IdRegistro)!;

            if (registroBuscado != null)
            {
                registroBuscado.IdAnalise = registroAtualizado.IdAnalise;
                registroBuscado.IdFuncionario = registroAtualizado.IdFuncionario;
                registroBuscado.Descricao = registroAtualizado.Descricao;
                registroBuscado.Prazo = registroAtualizado.Prazo;
                registroBuscado.Status = registroAtualizado.Status;

                _context.Registro.Update(registroBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, Registro novoRegistro)
    {
        try
        {
            Registro registroBuscado = _context.Registro.Find(Id)!;

            if (registroBuscado != null)
            {
                registroBuscado.IdAnalise = novoRegistro.IdAnalise;
                registroBuscado.IdFuncionario = novoRegistro.IdFuncionario;
                registroBuscado.Descricao = novoRegistro.Descricao;
                registroBuscado.Prazo = novoRegistro.Prazo;
                registroBuscado.Status = novoRegistro.Status;

                _context.Registro.Update(registroBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public Registro BuscarPorId(Guid Id)
    {
        try
        {
            Registro registroBuscado = _context.Registro.Find(Id.ToString())!;
            return registroBuscado;
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void Cadastrar(Registro novoRegistro)
    {
        try
        {
            novoRegistro.IdRegistro = Guid.NewGuid();
            _context.Registro.Add(novoRegistro);
            _context.SaveChanges();
        }
        catch (Exception)
        {
            throw;
        }

    }

    public void Deletar(Guid Id)
    {
        try
        {
            Registro registroBuscado = _context.Registro.Find(Id.ToString())!;
            if (registroBuscado != null)
            {
                _context.Registro.Remove(registroBuscado);
            }
            _context.SaveChanges();
        }
        catch (Exception)
        {
            throw;
        }
    }

    public List<Registro> Listar()
    {
        try
        {
            List<Registro> listaRegistro = _context.Registro.ToList();
            return listaRegistro;
        }
        catch (Exception)
        {
            throw;
        }
    }
}
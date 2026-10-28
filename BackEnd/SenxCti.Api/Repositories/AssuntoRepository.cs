using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class AssuntoRepository : IAssuntoRepository
{
    private readonly SenxContext _context;
    public AssuntoRepository(SenxContext context)
    {
        _context = context;
    }
    public void AtualizarIdCorpo(Assunto assuntoAtualizado)
    {
        try
        {
            Assunto assuntoBuscado = _context.Assunto.Find(assuntoAtualizado.IdAssunto)!;

            if (assuntoBuscado != null)
            {
                assuntoBuscado.Nome = assuntoAtualizado.Nome;
                assuntoBuscado.Descricao = assuntoAtualizado.Descricao;
                assuntoBuscado.Categoria = assuntoAtualizado.Categoria;

                _context.Assunto.Update(assuntoBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, Assunto assuntoAtualizado)
    {
        try
        {
            Assunto assuntoBuscado = _context.Assunto.Find(Id)!;

            if (assuntoBuscado != null)
            {
                assuntoBuscado.Nome = assuntoAtualizado.Nome;
                assuntoBuscado.Descricao = assuntoAtualizado.Descricao;
                assuntoBuscado.Categoria = assuntoAtualizado.Categoria;

                _context.Assunto.Update(assuntoBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public Assunto BuscarPorId(Guid Id)
    {
        try
        {
            Assunto asssuntoBuscado = _context.Assunto.Find(Id)!;
            return asssuntoBuscado;
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void Cadastrar(Assunto novoAssunto)
    {
        try
        {
            novoAssunto.IdAssunto = Guid.NewGuid();
            _context.Assunto.Add(novoAssunto);
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
            Assunto assuntoBuscado = _context.Assunto.Find(Id)!;
            if (assuntoBuscado != null)
            {
                _context.Assunto.Remove(assuntoBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public List<Assunto> Listar()
    {
        try
        {
            return _context.Assunto.ToList();
        }
        catch (Exception)
        {
            throw;
        }
    }
}

using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class CriterioRepository : ICriterioRepository
{
    private readonly SenxContext _context;
    public CriterioRepository(SenxContext context) 
    {
        _context = context;
    }
    public void AtualizarIdCorpo(Criterio criterioAtualizado)
    {
        try
        {
            Criterio criterioBuscado = _context.Criterio.Find(criterioAtualizado.IdCriterio)!;

            if (criterioBuscado != null)
            {
                criterioBuscado.Nome = criterioAtualizado.Nome;
                criterioBuscado.Descricao = criterioAtualizado.Descricao;
                criterioBuscado.RegraAvaliacao = criterioAtualizado.RegraAvaliacao;
                criterioBuscado.Versao = criterioAtualizado.Versao;
                criterioBuscado.Ativo = criterioAtualizado.Ativo;

                _context.Criterio.Update(criterioBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, Criterio criterioAtualizado)
    {
        try
        {
            Criterio criterioBuscado = _context.Criterio.Find(Id)!;

            if (criterioBuscado != null)
            {
                criterioBuscado.Nome = criterioAtualizado.Nome;
                criterioBuscado.Descricao = criterioAtualizado.Descricao;
                criterioBuscado.RegraAvaliacao = criterioAtualizado.RegraAvaliacao;
                criterioBuscado.Versao = criterioAtualizado.Versao;
                criterioBuscado.Ativo = criterioAtualizado.Ativo;

                _context.Criterio.Update(criterioBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public Criterio BuscarPorId(Guid Id)
    {
        return _context.Criterio.Find(Id)!;
    }

    public void Cadastrar(Criterio novoCriterio)
    {
        novoCriterio.IdCriterio = Guid.NewGuid();
        _context.Criterio.Add(novoCriterio);
        _context.SaveChanges();
    }

    public void Deletar(Guid Id)
    {
        var criterio = _context.Criterio.Find(Id);
        if (criterio is null) return;

        _context.Criterio.Remove(criterio);
        _context.SaveChanges();
    }

    public List<Criterio> Listar()
    {
        return _context.Criterio.ToList();
    }
}

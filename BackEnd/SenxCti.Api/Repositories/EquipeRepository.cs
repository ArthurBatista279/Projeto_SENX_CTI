using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class EquipeRepository : IEquipeRepository
{
    private readonly SenxContext _context;
    public EquipeRepository(SenxContext context)
    {
        _context = context;
    }

    public void AtualizarIdCorpo(Equipe equipeAtualizada)
    {
        try
        {
            Equipe equipeBuscada = _context.Equipe.Find(equipeAtualizada.IdEquipe)!;

            if (equipeBuscada != null)
            {
                equipeBuscada.Nome = equipeAtualizada.Nome;
                equipeBuscada.Departamento = equipeAtualizada.Departamento;

                _context.Equipe.Update(equipeBuscada);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, Equipe novaEquipe)
    {
        try
        {
            Equipe equipeBuscada = _context.Equipe.Find(Id)!;

            if (equipeBuscada != null)
            {
                equipeBuscada.Nome = novaEquipe.Nome;
                equipeBuscada.Departamento = novaEquipe.Departamento;

                _context.Equipe.Update(equipeBuscada);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public Equipe BuscarPorId(Guid Id)
    {
        try
        {
            Equipe equipeBuscada = _context.Equipe.Find(Id.ToString())!;
            return equipeBuscada;
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void Cadastrar(Equipe novaEquipe)
    {
        try
        {
            novaEquipe.IdEquipe = Guid.NewGuid();
            _context.Equipe.Add(novaEquipe);
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
            Equipe equipeBuscada = _context.Equipe.Find(Id.ToString())!;
            if (equipeBuscada != null)
            {
                _context.Equipe.Remove(equipeBuscada);
            }
            _context.SaveChanges();
        }
        catch (Exception)
        {
            throw;
        }
    }

    public List<Equipe> Listar()
    {
        try
        {
            List<Equipe> listaEquipe = _context.Equipe.ToList();
            return listaEquipe;
        }
        catch (Exception)
        {
            throw;
        }
    }
}
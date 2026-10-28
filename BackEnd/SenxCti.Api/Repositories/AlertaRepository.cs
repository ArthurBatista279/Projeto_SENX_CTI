using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;
using System.Data.SqlTypes;

namespace SenxCti.Api.Repositories;

public class AlertaRepository : IAlertaRepository
{
    private readonly SenxContext _context;
    public AlertaRepository(SenxContext context)
    {
        _context = context;
    }

    public void AtualizarIdCorpo(Alerta alertaAtualizado)
    {
        try
        {
            Alerta alertaBuscado = _context.Alerta.Find(alertaAtualizado.IdAlerta)!;

            if (alertaBuscado != null)
            {
                alertaBuscado.IdAnalise = alertaAtualizado.IdAnalise;
                alertaBuscado.IdEquipe = alertaAtualizado.IdEquipe;
                alertaBuscado.IdFuncionario = alertaAtualizado.IdFuncionario;
                alertaBuscado.Tipo = alertaAtualizado.Tipo;
                alertaBuscado.Severidade = alertaAtualizado.Severidade;
                alertaBuscado.Mensagem = alertaAtualizado.Mensagem;
                alertaBuscado.StatusTratamento = alertaAtualizado.StatusTratamento;
                alertaBuscado.StatusValidacao = alertaAtualizado.StatusValidacao;
                alertaBuscado.ValidadoEm = alertaAtualizado.ValidadoEm;
                alertaBuscado.Observacao = alertaAtualizado.Observacao;
                alertaBuscado.CriadoEm = alertaAtualizado.CriadoEm;
                alertaBuscado.ResolvidoEm = alertaAtualizado.ResolvidoEm;
                alertaBuscado.Justificativa = alertaAtualizado.Justificativa;
                alertaBuscado.TrechoEvidencia = alertaAtualizado.TrechoEvidencia;

                _context.Alerta.Update(alertaBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, Alerta alertaAtualizado)
    {
        try
        {
            Alerta alertaBuscado = _context.Alerta.Find(Id)!;

            if (alertaBuscado != null)
            {
                alertaBuscado.IdAnalise = alertaAtualizado.IdAnalise;
                alertaBuscado.IdEquipe = alertaAtualizado.IdEquipe;
                alertaBuscado.IdFuncionario = alertaAtualizado.IdFuncionario;
                alertaBuscado.Tipo = alertaAtualizado.Tipo;
                alertaBuscado.Severidade = alertaAtualizado.Severidade;
                alertaBuscado.Mensagem = alertaAtualizado.Mensagem;
                alertaBuscado.StatusTratamento = alertaAtualizado.StatusTratamento;
                alertaBuscado.StatusValidacao = alertaAtualizado.StatusValidacao;
                alertaBuscado.ValidadoEm = alertaAtualizado.ValidadoEm;
                alertaBuscado.Observacao = alertaAtualizado.Observacao;
                alertaBuscado.CriadoEm = alertaAtualizado.CriadoEm;
                alertaBuscado.ResolvidoEm = alertaAtualizado.ResolvidoEm;
                alertaBuscado.Justificativa = alertaAtualizado.Justificativa;
                alertaBuscado.TrechoEvidencia = alertaAtualizado.TrechoEvidencia;

                _context.Alerta.Update(alertaBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public Alerta BuscarPorId(Guid Id) 
    {
        try
        {
            Alerta alertaBuscado = _context.Alerta.Find(Id)!;
            return alertaBuscado;
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void Cadastrar(Alerta novoAlerta) 
    {

        try
        {
            novoAlerta.IdAlerta = Guid.NewGuid();

            _context.Alerta.Add(novoAlerta);
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
            Alerta alertaBuscado = _context.Alerta.Find(Id)!;
            if (alertaBuscado != null)
            {
                _context.Alerta.Remove(alertaBuscado);
            }
                _context.SaveChanges();
        }
        catch (Exception)
        {
            throw;
        }
    }

    public List<Alerta> Listar()
    {
        try
        {
            List<Alerta> listaAlerta = _context.Alerta.ToList();
            return listaAlerta;
        }
        catch (Exception)
        {
            throw;
        }
    }

}

using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class ResultadoRepository : IResultadoRepository
{
    private readonly SenxContext _context;
    public ResultadoRepository(SenxContext context)
    {
        _context = context;
    }

    public void AtualizarIdCorpo(Resultado resultadoAtualizado)
    {
        try
        {
            Resultado resultadoBuscado = _context.Resultado.Find(resultadoAtualizado.IdResultado)!;

            if (resultadoBuscado != null)
            {
                resultadoBuscado.IdCriterio = resultadoAtualizado.IdCriterio;
                resultadoBuscado.IdAnalise = resultadoAtualizado.IdAnalise;
                resultadoBuscado.IdFuncionario = resultadoAtualizado.IdFuncionario;
                resultadoBuscado.Classificacao = resultadoAtualizado.Classificacao;
                resultadoBuscado.Score = resultadoAtualizado.Score;
                resultadoBuscado.Justificativa = resultadoAtualizado.Justificativa;
                resultadoBuscado.TrechoEvidencia = resultadoAtualizado.TrechoEvidencia;
                resultadoBuscado.ResultadoValidado = resultadoAtualizado.ResultadoValidado;
                resultadoBuscado.StatusValidacao = resultadoAtualizado.StatusValidacao;
                resultadoBuscado.ValidadoEm = resultadoAtualizado.ValidadoEm;
                resultadoBuscado.ObservacaoValidacao = resultadoAtualizado.ObservacaoValidacao;

                _context.Resultado.Update(resultadoBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, Resultado novoResultado)
    {
        try
        {
            Resultado resultadoBuscado = _context.Resultado.Find(Id)!;

            if (resultadoBuscado != null)
            {
                resultadoBuscado.IdCriterio = novoResultado.IdCriterio;
                resultadoBuscado.IdAnalise = novoResultado.IdAnalise;
                resultadoBuscado.IdFuncionario = novoResultado.IdFuncionario;
                resultadoBuscado.Classificacao = novoResultado.Classificacao;
                resultadoBuscado.Score = novoResultado.Score;
                resultadoBuscado.Justificativa = novoResultado.Justificativa;
                resultadoBuscado.TrechoEvidencia = novoResultado.TrechoEvidencia;
                resultadoBuscado.ResultadoValidado = novoResultado.ResultadoValidado;
                resultadoBuscado.StatusValidacao = novoResultado.StatusValidacao;
                resultadoBuscado.ValidadoEm = novoResultado.ValidadoEm;
                resultadoBuscado.ObservacaoValidacao = novoResultado.ObservacaoValidacao;

                _context.Resultado.Update(resultadoBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public Resultado BuscarPorId(Guid Id)
    {
        try
        {
            Resultado resultadoBuscado = _context.Resultado.Find(Id)!;
            return resultadoBuscado;
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void Cadastrar(Resultado novoResultado)
    {
        try
        {
            novoResultado.IdResultado = Guid.NewGuid();
            _context.Resultado.Add(novoResultado);
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
            Resultado resultadoBuscado = _context.Resultado.Find(Id)!;
            if (resultadoBuscado != null)
            {
                _context.Resultado.Remove(resultadoBuscado);
            }
            _context.SaveChanges();
        }
        catch (Exception)
        {
            throw;
        }
    }

    public List<Resultado> Listar()
    {
        try
        {
            List<Resultado> listaResultado = _context.Resultado.ToList();
            return listaResultado;
        }
        catch (Exception)
        {
            throw;
        }
    }
}
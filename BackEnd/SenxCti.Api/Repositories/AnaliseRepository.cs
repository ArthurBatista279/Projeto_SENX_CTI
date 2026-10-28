using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class AnaliseRepository : IAnaliseRepository
{
    private readonly SenxContext _context;
    public AnaliseRepository(SenxContext context)
    {
        _context = context;
    }

    public void AtualizarIdCorpo(Analise analiseAtualizada)
    {
        try
        {
            Analise analiseBuscada = _context.Analise.Find(analiseAtualizada.IdAnalise)!;

            if (analiseBuscada != null)
            {
                analiseBuscada.IdLigacao = analiseAtualizada.IdLigacao;
                analiseBuscada.DataAnalise = analiseAtualizada.DataAnalise;
                analiseBuscada.ResolucaoEncaminhamento = analiseAtualizada.ResolucaoEncaminhamento;
                analiseBuscada.StatusProcessamento = analiseAtualizada.StatusProcessamento;
                analiseBuscada.ModeloVersao = analiseAtualizada.ModeloVersao;
                analiseBuscada.TranscricaoTexto = analiseAtualizada.TranscricaoTexto;
                analiseBuscada.ResumoTexto = analiseAtualizada.ResumoTexto;
                analiseBuscada.Cancelamento = analiseAtualizada.Cancelamento;
                analiseBuscada.Oportunidade = analiseAtualizada.Oportunidade;
                analiseBuscada.ScoreGeral = analiseAtualizada.ScoreGeral;
                analiseBuscada.ProblemaNecessidade = analiseAtualizada.ProblemaNecessidade;
                analiseBuscada.Compromissos = analiseAtualizada.Compromissos;

                _context.Analise.Update(analiseBuscada);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, Analise novaAnalise)
    {
        try
        {
            Analise analiseBuscada = _context.Analise.Find(Id)!;

            if (analiseBuscada != null)
            {
                analiseBuscada.IdLigacao = novaAnalise.IdLigacao;
                analiseBuscada.DataAnalise = novaAnalise.DataAnalise;
                analiseBuscada.ResolucaoEncaminhamento = novaAnalise.ResolucaoEncaminhamento;
                analiseBuscada.StatusProcessamento = novaAnalise.StatusProcessamento;
                analiseBuscada.ModeloVersao = novaAnalise.ModeloVersao;
                analiseBuscada.TranscricaoTexto = novaAnalise.TranscricaoTexto;
                analiseBuscada.ResumoTexto = novaAnalise.ResumoTexto;
                analiseBuscada.Cancelamento = novaAnalise.Cancelamento;
                analiseBuscada.Oportunidade = novaAnalise.Oportunidade;
                analiseBuscada.ScoreGeral = novaAnalise.ScoreGeral;
                analiseBuscada.ProblemaNecessidade = novaAnalise.ProblemaNecessidade;
                analiseBuscada.Compromissos = novaAnalise.Compromissos;

                _context.Analise.Update(analiseBuscada);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public Analise BuscarPorId(Guid Id)
    {
        try
        {
            Analise analiseBuscada = _context.Analise.Find(Id.ToString())!;
            return analiseBuscada;
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void Cadastrar(Analise novaAnalise)
    {
        try
        {
            novaAnalise.IdAnalise = Guid.NewGuid();
            _context.Analise.Add(novaAnalise);
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
            Analise analiseBuscada = _context.Analise.Find(Id.ToString())!;
            if (analiseBuscada != null)
            {
                _context.Analise.Remove(analiseBuscada);
            }
            _context.SaveChanges();
        }
        catch (Exception)
        {
            throw;
        }
    }

    public List<Analise> Listar()
    {
        try
        {
            List<Analise> listaAnalise = _context.Analise.ToList();
            return listaAnalise;
        }
        catch (Exception)
        {
            throw;
        }
    }
}
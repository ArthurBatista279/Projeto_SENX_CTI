using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class LigacaoRepository : ILigacaoRepository
{
    private readonly SenxContext _context;
    public LigacaoRepository(SenxContext context)
    {
        _context = context;
    }

    public void AtualizarIdCorpo(Ligacao ligacaoAtualizada)
    {
        try
        {
            Ligacao ligacaoBuscada = _context.Ligacao.Find(ligacaoAtualizada.IdLigacao)!;

            if (ligacaoBuscada != null)
            {
                ligacaoBuscada.IdFuncionario = ligacaoAtualizada.IdFuncionario;
                ligacaoBuscada.IdCliente = ligacaoAtualizada.IdCliente;
                ligacaoBuscada.DataInicio = ligacaoAtualizada.DataInicio;
                ligacaoBuscada.Duracao = ligacaoAtualizada.Duracao;
                ligacaoBuscada.NumeroOrigem = ligacaoAtualizada.NumeroOrigem;
                ligacaoBuscada.NumeroDestino = ligacaoAtualizada.NumeroDestino;
                ligacaoBuscada.Stats = ligacaoAtualizada.Stats;
                ligacaoBuscada.HashAudio = ligacaoAtualizada.HashAudio;
                ligacaoBuscada.CaminhoArquivo = ligacaoAtualizada.CaminhoArquivo;
                ligacaoBuscada.IdentificadorPabx = ligacaoAtualizada.IdentificadorPabx;
                ligacaoBuscada.Direcao = ligacaoAtualizada.Direcao;

                _context.Ligacao.Update(ligacaoBuscada);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, Ligacao novaLigacao)
    {
        try
        {
            Ligacao ligacaoBuscada = _context.Ligacao.Find(Id)!;

            if (ligacaoBuscada != null)
            {
                ligacaoBuscada.IdFuncionario = novaLigacao.IdFuncionario;
                ligacaoBuscada.IdCliente = novaLigacao.IdCliente;
                ligacaoBuscada.DataInicio = novaLigacao.DataInicio;
                ligacaoBuscada.Duracao = novaLigacao.Duracao;
                ligacaoBuscada.NumeroOrigem = novaLigacao.NumeroOrigem;
                ligacaoBuscada.NumeroDestino = novaLigacao.NumeroDestino;
                ligacaoBuscada.Stats = novaLigacao.Stats;
                ligacaoBuscada.HashAudio = novaLigacao.HashAudio;
                ligacaoBuscada.CaminhoArquivo = novaLigacao.CaminhoArquivo;
                ligacaoBuscada.IdentificadorPabx = novaLigacao.IdentificadorPabx;
                ligacaoBuscada.Direcao = novaLigacao.Direcao;

                _context.Ligacao.Update(ligacaoBuscada);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public Ligacao BuscarPorId(Guid Id)
    {
        try
        {
            Ligacao ligacaoBuscada = _context.Ligacao.Find(Id.ToString())!;
            return ligacaoBuscada;
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void Cadastrar(Ligacao novaLigacao)
    {
        try
        {
            novaLigacao.IdLigacao = Guid.NewGuid();
            _context.Ligacao.Add(novaLigacao);
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
            Ligacao ligacaoBuscada = _context.Ligacao.Find(Id.ToString())!;
            if (ligacaoBuscada != null)
            {
                _context.Ligacao.Remove(ligacaoBuscada);
            }
            _context.SaveChanges();
        }
        catch (Exception)
        {
            throw;
        }
    }

    public List<Ligacao> Listar()
    {
        try
        {
            List<Ligacao> listaLigacao = _context.Ligacao.ToList();
            return listaLigacao;
        }
        catch (Exception)
        {
            throw;
        }
    }
}
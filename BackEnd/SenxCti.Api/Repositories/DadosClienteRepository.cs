using SenxCti.Api.Data;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Repositories;

public class DadosClienteRepository : IDadosClienteRepository
{
    private readonly SenxContext _context;
    public DadosClienteRepository(SenxContext context)
    {
        _context = context;
    }

    public void AtualizarIdCorpo(DadosCliente dadosClienteAtualizado)
    {
        try
        {
            DadosCliente dadosClienteBuscado = _context.DadosCliente.Find(dadosClienteAtualizado.IdDadosCliente)!;

            if (dadosClienteBuscado != null)
            {
                dadosClienteBuscado.IdUsuario = dadosClienteAtualizado.IdUsuario;
                dadosClienteBuscado.Nome = dadosClienteAtualizado.Nome;
                dadosClienteBuscado.Email = dadosClienteAtualizado.Email;
                dadosClienteBuscado.Telefone = dadosClienteAtualizado.Telefone;
                dadosClienteBuscado.Situacao = dadosClienteAtualizado.Situacao;
                dadosClienteBuscado.Consentimento = dadosClienteAtualizado.Consentimento;

                _context.DadosCliente.Update(dadosClienteBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void AtualizarIdUrl(Guid Id, DadosCliente novoDadosCliente)
    {
        try
        {
            DadosCliente dadosClienteBuscado = _context.DadosCliente.Find(Id)!;

            if (dadosClienteBuscado != null)
            {
                dadosClienteBuscado.IdUsuario = novoDadosCliente.IdUsuario;
                dadosClienteBuscado.Nome = novoDadosCliente.Nome;
                dadosClienteBuscado.Email = novoDadosCliente.Email;
                dadosClienteBuscado.Telefone = novoDadosCliente.Telefone;
                dadosClienteBuscado.Situacao = novoDadosCliente.Situacao;
                dadosClienteBuscado.Consentimento = novoDadosCliente.Consentimento;

                _context.DadosCliente.Update(dadosClienteBuscado);
                _context.SaveChanges();
            }
        }
        catch (Exception)
        {
            throw;
        }
    }

    public DadosCliente BuscarPorId(Guid Id)
    {
        try
        {
            DadosCliente dadosClienteBuscado = _context.DadosCliente.Find(Id)!;
            return dadosClienteBuscado;
        }
        catch (Exception)
        {
            throw;
        }
    }

    public void Cadastrar(DadosCliente novoDadosCliente)
    {
        try
        {
            novoDadosCliente.IdDadosCliente = Guid.NewGuid();
            _context.DadosCliente.Add(novoDadosCliente);
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
            DadosCliente dadosClienteBuscado = _context.DadosCliente.Find(Id)!;
            if (dadosClienteBuscado != null)
            {
                _context.DadosCliente.Remove(dadosClienteBuscado);
            }
            _context.SaveChanges();
        }
        catch (Exception)
        {
            throw;
        }
    }

    public List<DadosCliente> Listar()
    {
        try
        {
            List<DadosCliente> listaDadosCliente = _context.DadosCliente.ToList();
            return listaDadosCliente;
        }
        catch (Exception)
        {
            throw;
        }
    }
}
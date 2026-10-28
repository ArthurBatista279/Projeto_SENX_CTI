using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class DadosClienteController : ControllerBase
{
    private readonly IDadosClienteRepository _dadosClienteRepository;
    public DadosClienteController(IDadosClienteRepository dadosClienteRepository)
    {
        _dadosClienteRepository = dadosClienteRepository;
    }

    [HttpGet("{Id}")]
    public IActionResult GetById(Guid Id) 
    {
        try 
        {
            return Ok(_dadosClienteRepository.BuscarPorId(Id));
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpGet]
    public IActionResult Get() 
    {
        try
        {
            return Ok(_dadosClienteRepository.Listar());
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPost]
    public IActionResult Post(DadosCliente novoDadosCliente) 
    {
        try
        {
            _dadosClienteRepository.Cadastrar(novoDadosCliente);
            return StatusCode(201);

        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }
}

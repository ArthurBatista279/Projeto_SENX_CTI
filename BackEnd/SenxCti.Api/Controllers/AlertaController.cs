using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AlertaController : ControllerBase
{
    private readonly IAlertaRepository _alertaRepository;
    public AlertaController(IAlertaRepository alertaRepository)
    {
        _alertaRepository = alertaRepository;
    }

    [HttpGet("{Id}")]
    public IActionResult GetById(Guid Id)
    {
        try
        {
            return Ok(_alertaRepository.BuscarPorId(Id));
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
            return Ok(_alertaRepository.Listar());
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPost]
    public IActionResult Post(Alerta novoAlerta)
    {
        try
        {
            _alertaRepository.Cadastrar(novoAlerta);
            return StatusCode(201);

        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPut("{Id}")]
    public IActionResult PutById(Guid Id, Alerta alertaAtualizado)
    {
        try
        {
            _alertaRepository.AtualizarIdUrl(Id, alertaAtualizado);
            return NoContent();
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPut]
    public IActionResult Put(Alerta alertaAtualizado)
    {
        try
        {
            _alertaRepository.AtualizarIdCorpo(alertaAtualizado);
            return NoContent();
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpDelete("{Id}")]
    public IActionResult DeleteById(Guid Id) 
    {
        try
        {
            _alertaRepository.Deletar(Id);
            return NoContent();
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }
}

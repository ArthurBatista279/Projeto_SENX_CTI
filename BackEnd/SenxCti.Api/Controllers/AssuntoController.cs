using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AssuntoController : ControllerBase
{
    private readonly IAssuntoRepository _assuntoRepository;
    public AssuntoController(IAssuntoRepository assuntoRepository)
    {
        _assuntoRepository = assuntoRepository;
    }

    [HttpGet("{Id}")]
    public IActionResult GetById(Guid Id) 
    {
        try 
        {
            return Ok(_assuntoRepository.BuscarPorId(Id));
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
            return Ok(_assuntoRepository.Listar());
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPost]
    public IActionResult Post(Assunto novoAssunto) 
    {
        try
        {
            _assuntoRepository.Cadastrar(novoAssunto);
            return StatusCode(201);

        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }
}

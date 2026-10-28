using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ResultadoController : ControllerBase
{
    private readonly IResultadoRepository _resultadoRepository;
    public ResultadoController(IResultadoRepository resultadoRepository)
    {
        _resultadoRepository = resultadoRepository;
    }

    [HttpGet("{Id}")]
    public IActionResult GetById(Guid Id) 
    {
        try 
        {
            return Ok(_resultadoRepository.BuscarPorId(Id));
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
            return Ok(_resultadoRepository.Listar());
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPost]
    public IActionResult Post(Resultado novoResultado) 
    {
        try
        {
            _resultadoRepository.Cadastrar(novoResultado);
            return StatusCode(201);

        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }
}

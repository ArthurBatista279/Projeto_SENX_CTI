using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AnaliseController : ControllerBase
{
    private readonly IAnaliseRepository _analiseRepository;
    public AnaliseController(IAnaliseRepository analiseRepository)
    {
        _analiseRepository = analiseRepository;
    }

    [HttpGet("{Id}")]
    public IActionResult GetById(Guid Id) 
    {
        try 
        {
            return Ok(_analiseRepository.BuscarPorId(Id));
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
            return Ok(_analiseRepository.Listar());
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPost]
    public IActionResult Post(Analise novaAnalise) 
    {
        try
        {
            _analiseRepository.Cadastrar(novaAnalise);
            return StatusCode(201);

        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }
}

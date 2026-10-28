using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class EquipeController : ControllerBase
{
    private readonly IEquipeRepository _equipeRepository;
    public EquipeController(IEquipeRepository equipeRepository)
    {
        _equipeRepository = equipeRepository;
    }

    [HttpGet("{Id}")]
    public IActionResult GetById(Guid Id) 
    {
        try 
        {
            return Ok(_equipeRepository.BuscarPorId(Id));
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
            return Ok(_equipeRepository.Listar());
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPost]
    public IActionResult Post(Equipe novaEquipe) 
    {
        try
        {
            _equipeRepository.Cadastrar(novaEquipe);
            return StatusCode(201);

        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class CriterioController : ControllerBase
{
    private readonly ICriterioRepository _criterioRepository;
    public CriterioController(ICriterioRepository criterioRepository)
    {
        _criterioRepository = criterioRepository;
    }

    [HttpGet("{Id}")]
    public IActionResult GetById(Guid Id) 
    {
        try 
        {
            return Ok(_criterioRepository.BuscarPorId(Id));
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
            return Ok(_criterioRepository.Listar());
        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }

    [HttpPost]
    public IActionResult Post(Criterio novoCriterio) 
    {
        try
        {
            _criterioRepository.Cadastrar(novoCriterio);
            return StatusCode(201);

        }
        catch (Exception e)
        {
            return BadRequest(e.Message);
        }
    }
}

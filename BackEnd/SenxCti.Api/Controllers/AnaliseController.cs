using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AnaliseController(IAnaliseRepository _analiseRepository) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _analiseRepository.BuscarPorId(Id);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_analiseRepository.Listar());

    [HttpPost]
    public IActionResult Post([FromBody] Analise novo)
    {
        _analiseRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    public IActionResult PutById(Guid Id, [FromBody] Analise atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_analiseRepository.BuscarPorId(Id) is null) return NotFound();
        _analiseRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpPut]
    public IActionResult Put([FromBody] Analise atualizado)
    {
        if (atualizado.IdAnalise == Guid.Empty)
            return BadRequest("Informe um ID válido no corpo da requisição.");
        if (_analiseRepository.BuscarPorId(atualizado.IdAnalise) is null) return NotFound();
        _analiseRepository.AtualizarIdCorpo(atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    public IActionResult DeleteById(Guid Id)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_analiseRepository.BuscarPorId(Id) is null) return NotFound();
        _analiseRepository.Deletar(Id);
        return NoContent();
    }
}

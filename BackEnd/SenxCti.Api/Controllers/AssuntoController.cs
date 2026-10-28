using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = "Admin")]
public class AssuntoController(IAssuntoRepository _assuntoRepository) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _assuntoRepository.BuscarPorId(Id);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_assuntoRepository.Listar());

    [HttpPost]
    public IActionResult Post([FromBody] Assunto novo)
    {
        _assuntoRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    public IActionResult PutById(Guid Id, [FromBody] Assunto atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_assuntoRepository.BuscarPorId(Id) is null) return NotFound();
        _assuntoRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpPut]
    public IActionResult Put([FromBody] Assunto atualizado)
    {
        if (atualizado.IdAssunto == Guid.Empty)
            return BadRequest("Informe um ID válido no corpo da requisição.");
        if (_assuntoRepository.BuscarPorId(atualizado.IdAssunto) is null) return NotFound();
        _assuntoRepository.AtualizarIdCorpo(atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    public IActionResult DeleteById(Guid Id)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_assuntoRepository.BuscarPorId(Id) is null) return NotFound();
        _assuntoRepository.Deletar(Id);
        return NoContent();
    }
}

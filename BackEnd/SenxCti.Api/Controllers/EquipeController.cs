using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = "Admin")]
public class EquipeController(IEquipeRepository _equipeRepository) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _equipeRepository.BuscarPorId(Id);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_equipeRepository.Listar());

    [HttpPost]
    public IActionResult Post([FromBody] Equipe novo)
    {
        _equipeRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    public IActionResult PutById(Guid Id, [FromBody] Equipe atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_equipeRepository.BuscarPorId(Id) is null) return NotFound();
        _equipeRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpPut]
    public IActionResult Put([FromBody] Equipe atualizado)
    {
        if (atualizado.IdEquipe == Guid.Empty)
            return BadRequest("Informe um ID válido no corpo da requisição.");
        if (_equipeRepository.BuscarPorId(atualizado.IdEquipe) is null) return NotFound();
        _equipeRepository.AtualizarIdCorpo(atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    public IActionResult DeleteById(Guid Id)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_equipeRepository.BuscarPorId(Id) is null) return NotFound();
        _equipeRepository.Deletar(Id);
        return NoContent();
    }
}

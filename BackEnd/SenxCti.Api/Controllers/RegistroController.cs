using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = "Admin")]
public class RegistroController(IRegistroRepository _registroRepository) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _registroRepository.BuscarPorId(Id);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_registroRepository.Listar());

    [HttpPost]
    public IActionResult Post([FromBody] Registro novo)
    {
        _registroRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    public IActionResult PutById(Guid Id, [FromBody] Registro atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_registroRepository.BuscarPorId(Id) is null) return NotFound();
        _registroRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    public IActionResult DeleteById(Guid Id)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_registroRepository.BuscarPorId(Id) is null) return NotFound();
        _registroRepository.Deletar(Id);
        return NoContent();
    }
}

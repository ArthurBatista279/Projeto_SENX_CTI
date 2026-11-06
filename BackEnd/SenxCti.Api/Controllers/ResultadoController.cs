using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = "Admin")]
public class ResultadoController(IResultadoRepository _resultadoRepository) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _resultadoRepository.BuscarPorId(Id);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_resultadoRepository.Listar());

    [HttpPost]
    public IActionResult Post([FromBody] Resultado novo)
    {
        _resultadoRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    public IActionResult PutById(Guid Id, [FromBody] Resultado atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_resultadoRepository.BuscarPorId(Id) is null) return NotFound();
        _resultadoRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    public IActionResult DeleteById(Guid Id)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_resultadoRepository.BuscarPorId(Id) is null) return NotFound();
        _resultadoRepository.Deletar(Id);
        return NoContent();
    }
}

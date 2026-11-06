using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = "Admin")]
public class AlertaController(IAlertaRepository _alertaRepository) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _alertaRepository.BuscarPorId(Id);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_alertaRepository.Listar());

    [HttpPost]
    public IActionResult Post([FromBody] Alerta novo)
    {
        _alertaRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    public IActionResult PutById(Guid Id, [FromBody] Alerta atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_alertaRepository.BuscarPorId(Id) is null) return NotFound();
        _alertaRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    public IActionResult DeleteById(Guid Id)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_alertaRepository.BuscarPorId(Id) is null) return NotFound();
        _alertaRepository.Deletar(Id);
        return NoContent();
    }
}

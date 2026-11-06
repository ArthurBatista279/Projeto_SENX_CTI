using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class CriterioController(ICriterioRepository _criterioRepository, SenxCti.Api.Auth.DevelopmentCrudAccess developmentCrud) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _criterioRepository.BuscarPorId(Id);
        return entity is null || (!entity.Ativo && !developmentCrud.Enabled && !User.IsInRole("Administrador")) ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_criterioRepository.Listar()
        .Where(criterio => criterio.Ativo || developmentCrud.Enabled || User.IsInRole("Administrador")));

    [HttpPost]
    [Authorize(Policy = "Admin")]
    public IActionResult Post([FromBody] Criterio novo)
    {
        _criterioRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    [Authorize(Policy = "Admin")]
    public IActionResult PutById(Guid Id, [FromBody] Criterio atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_criterioRepository.BuscarPorId(Id) is null) return NotFound();
        _criterioRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    [Authorize(Policy = "Admin")]
    public IActionResult DeleteById(Guid Id)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_criterioRepository.BuscarPorId(Id) is null) return NotFound();
        _criterioRepository.Deletar(Id);
        return NoContent();
    }
}

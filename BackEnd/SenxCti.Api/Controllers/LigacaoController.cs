using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = "Admin")]
public class LigacaoController(ILigacaoRepository _ligacaoRepository) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _ligacaoRepository.BuscarPorId(Id);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_ligacaoRepository.Listar());

    [HttpPost]
    public IActionResult Post([FromBody] Ligacao novo)
    {
        _ligacaoRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    public IActionResult PutById(Guid Id, [FromBody] Ligacao atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_ligacaoRepository.BuscarPorId(Id) is null) return NotFound();
        _ligacaoRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpPut]
    public IActionResult Put([FromBody] Ligacao atualizado)
    {
        if (atualizado.IdLigacao == Guid.Empty)
            return BadRequest("Informe um ID válido no corpo da requisição.");
        if (_ligacaoRepository.BuscarPorId(atualizado.IdLigacao) is null) return NotFound();
        _ligacaoRepository.AtualizarIdCorpo(atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    public IActionResult DeleteById(Guid Id)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_ligacaoRepository.BuscarPorId(Id) is null) return NotFound();
        _ligacaoRepository.Deletar(Id);
        return NoContent();
    }
}

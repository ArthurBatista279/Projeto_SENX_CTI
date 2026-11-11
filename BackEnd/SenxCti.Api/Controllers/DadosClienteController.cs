using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.Interfaces;
using SenxCti.Api.Models;

namespace SenxCti.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = "Admin")]
public class DadosClienteController(IDadosClienteRepository _dadosClienteRepository) : ControllerBase
{
    [HttpGet("{Id:guid}")]
    public IActionResult GetById(Guid Id)
    {
        var entity = _dadosClienteRepository.BuscarPorId(Id);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpGet]
    public IActionResult Get() => Ok(_dadosClienteRepository.Listar());

    [HttpPost]
    public IActionResult Post([FromBody] DadosCliente novo)
    {
        _dadosClienteRepository.Cadastrar(novo);
        return StatusCode(201);
    }

    [HttpPut("{Id:guid}")]
    public IActionResult PutById(Guid Id, [FromBody] DadosCliente atualizado)
    {
        if (Id == Guid.Empty) return BadRequest("Informe um ID válido.");
        if (_dadosClienteRepository.BuscarPorId(Id) is null) return NotFound();
        _dadosClienteRepository.AtualizarIdUrl(Id, atualizado);
        return NoContent();
    }

    [HttpDelete("{Id:guid}")]
    public async Task<IResult> DeleteById(Guid Id, [FromServices] SenxCti.Api.Database.CadastroDeletion deletion, CancellationToken token)
    {
        return (await deletion.Delete(false,Id,Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value),token)).ToHttp();
    }
}

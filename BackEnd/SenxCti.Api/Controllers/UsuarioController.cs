using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenxCti.Api.DTO;
using SenxCti.Api.Interfaces;

namespace SenxCti.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Policy = "Admin")]
public class UsuarioController(IUsuarioRepository repository, IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet]
    public ActionResult<IEnumerable<UsuarioRespostaDTO>> Get() =>
        Ok(repository.Listar().Select(UsuarioRespostaDTO.FromModel));

    [HttpGet("{id:guid}")]
    public ActionResult<UsuarioRespostaDTO> GetById(Guid id)
    {
        var user = repository.BuscarPorId(id);
        return user is null ? NotFound() : Ok(UsuarioRespostaDTO.FromModel(user));
    }

    [HttpPost]
    [ProducesResponseType(typeof(UsuarioRespostaDTO), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<UsuarioRespostaDTO>> Post([FromForm] UsuarioDTO input)
    {
        var user = input.ToModel();
        user.Imagem = await SalvarImagem(input.Imagem);
        try
        {
            user = repository.Cadastrar(user);
        }
        catch
        {
            ExcluirImagem(user.Imagem);
            throw;
        }
        return CreatedAtAction(nameof(GetById), new { id = user.IdUsuario }, UsuarioRespostaDTO.FromModel(user));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Put(Guid id, [FromForm] UsuarioDTO input)
    {
        var existente = repository.BuscarPorId(id);
        if (existente is null) return NotFound();
        var user = input.ToModel(id);
        var novaImagem = await SalvarImagem(input.Imagem);
        user.Imagem = string.IsNullOrEmpty(novaImagem) ? existente.Imagem : novaImagem;
        try
        {
            repository.AtualizarIdUrl(id, user);
        }
        catch
        {
            ExcluirImagem(novaImagem);
            throw;
        }
        return NoContent();
    }

    private string PastaImagens => Path.Combine(environment.ContentRootPath, "wwwroot", "imagens");

    private async Task<string> SalvarImagem(IFormFile? imagem)
    {
        if (imagem is null || imagem.Length == 0) return string.Empty;

        var nomeArquivo = $"{Guid.NewGuid()}{Path.GetExtension(imagem.FileName).ToLowerInvariant()}";
        Directory.CreateDirectory(PastaImagens);
        try
        {
            await using var stream = new FileStream(Path.Combine(PastaImagens, nomeArquivo), FileMode.CreateNew);
            await imagem.CopyToAsync(stream, HttpContext.RequestAborted);
        }
        catch
        {
            ExcluirImagem(nomeArquivo);
            throw;
        }
        return nomeArquivo;
    }

    private void ExcluirImagem(string nomeArquivo)
    {
        if (!string.IsNullOrEmpty(nomeArquivo))
            System.IO.File.Delete(Path.Combine(PastaImagens, nomeArquivo));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IResult> Delete(Guid id, [FromServices] SenxCti.Api.Database.CadastroDeletion deletion, CancellationToken token)
    {
        return (await deletion.Delete(true,id,Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value),token)).ToHttp();
    }
}

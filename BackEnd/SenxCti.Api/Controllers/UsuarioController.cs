using Microsoft.AspNetCore.Mvc;

namespace SenxCti.Api.Controllers;

public class UsuarioController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}

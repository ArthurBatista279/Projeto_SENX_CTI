using Microsoft.AspNetCore.Mvc;

namespace SenxCti.Api.Controllers;

public class DadosClienteController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}

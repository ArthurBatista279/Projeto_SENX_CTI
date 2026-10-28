using Microsoft.AspNetCore.Mvc;

namespace SenxCti.Api.Controllers;

public class AssuntoController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}

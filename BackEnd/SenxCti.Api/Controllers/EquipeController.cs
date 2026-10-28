using Microsoft.AspNetCore.Mvc;

namespace SenxCti.Api.Controllers;

public class EquipeController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}

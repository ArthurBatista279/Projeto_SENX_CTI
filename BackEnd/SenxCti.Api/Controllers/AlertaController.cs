using Microsoft.AspNetCore.Mvc;

namespace SenxCti.Api.Controllers;

public class AlertaController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}

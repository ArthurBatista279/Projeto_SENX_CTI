using Microsoft.AspNetCore.Mvc;

namespace SenxCti.Api.Controllers;

public class LoginController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}

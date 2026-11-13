using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Ticketee.Services;

namespace Ticketee.Pages;

[EnableRateLimiting("auth")]
public class RegisterModel : AppPageModel
{
    private readonly AuthService _auth;

    public RegisterModel(AuthService auth) => _auth = auth;

    [BindProperty] public string? Name { get; set; }
    [BindProperty] public string? Email { get; set; }
    [BindProperty] public string? Password { get; set; }

    public IActionResult OnGet() =>
        User.Identity?.IsAuthenticated == true ? Redirect("/projects") : Page();

    public async Task<IActionResult> OnPostAsync()
    {
        try
        {
            var user = await _auth.RegisterAsync(Email, Password, Name);
            await _auth.SignInWebAsync(user);
            return Redirect("/projects");
        }
        catch (AppException ex)
        {
            Error = ex.Message;
            return Page();
        }
    }
}

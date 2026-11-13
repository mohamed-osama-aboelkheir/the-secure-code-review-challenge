using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Ticketee.Services;

namespace Ticketee.Pages;

[EnableRateLimiting("auth")]
public class LoginModel : AppPageModel
{
    private readonly AuthService _auth;

    public LoginModel(AuthService auth) => _auth = auth;

    [BindProperty] public string? Email { get; set; }
    [BindProperty] public string? Password { get; set; }
    [BindProperty(SupportsGet = true)] public string? ReturnUrl { get; set; }

    public IActionResult OnGet() =>
        User.Identity?.IsAuthenticated == true ? Redirect("/projects") : Page();

    public async Task<IActionResult> OnPostAsync()
    {
        try
        {
            var user = await _auth.ValidateCredentialsAsync(Email, Password);
            await _auth.SignInWebAsync(user);
            return Url.IsLocalUrl(ReturnUrl) ? LocalRedirect(ReturnUrl) : Redirect("/projects");
        }
        catch (AppException ex)
        {
            Error = ex.Message;
            return Page();
        }
    }
}

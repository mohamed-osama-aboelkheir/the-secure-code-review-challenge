using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages;

public class LogoutModel : PageModel
{
    private readonly AuthService _auth;
    private readonly UserManager<User> _users;

    public LogoutModel(AuthService auth, UserManager<User> users)
    {
        _auth = auth;
        _users = users;
    }

    public IActionResult OnGet() => Redirect("/");

    public async Task<IActionResult> OnPostAsync()
    {
        var user = User.Identity?.IsAuthenticated == true ? await _users.GetUserAsync(User) : null;
        await _auth.SignOutWebAsync(user);
        return Redirect("/");
    }
}

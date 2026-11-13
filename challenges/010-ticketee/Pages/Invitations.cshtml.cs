using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages;

public class InvitationsModel : AppPageModel
{
    private readonly ProjectService _projects;
    private readonly UserManager<User> _users;

    public InvitationsModel(ProjectService projects, UserManager<User> users)
    {
        _projects = projects;
        _users = users;
    }

    [BindProperty] public string? Code { get; set; }

    public void OnGet() { }

    public async Task<IActionResult> OnPostAsync()
    {
        var user = await _users.GetUserAsync(User);
        if (user is null) return Redirect("/login");

        try
        {
            var project = await _projects.AcceptInvitationAsync(user, Code);
            Flash = $"Welcome to {project.Name}! You're now a member.";
            return Redirect($"/projects/{project.Key}");
        }
        catch (AppException ex)
        {
            Error = ex.Message;
            return Page();
        }
    }
}

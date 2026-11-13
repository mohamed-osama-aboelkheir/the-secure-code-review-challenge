using Microsoft.AspNetCore.Mvc;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages.Projects;

public class MembersModel : ProjectPageModel
{
    public MembersModel(ProjectService projects) : base(projects) { }

    [BindProperty] public string? Email { get; set; }

    public List<Invitation> PendingInvitations { get; private set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        try
        {
            await LoadAsync();
            return Page();
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }
    }

    public async Task<IActionResult> OnPostAsync()
    {
        try
        {
            await LoadAsync();
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }

        try
        {
            var invitation = await Projects.InviteAsync(Project.Key, UserId, Email);
            Flash = $"Invitation created for {invitation.Email}. Share the code {invitation.Code} with them.";
            return Redirect($"/projects/{Project.Key}/members");
        }
        catch (AppException ex) when (ex.Status is 400 or 403)
        {
            Error = ex.Message;
            return Page();
        }
    }

    private async Task LoadAsync()
    {
        await LoadProjectAsync();
        PendingInvitations = await Projects.ListPendingInvitationsAsync(Project, UserId);
    }
}

using Microsoft.AspNetCore.Mvc;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages.Projects;

public class IssueModel : ProjectPageModel
{
    private readonly IssueService _issues;

    public IssueModel(ProjectService projects, IssueService issues) : base(projects) => _issues = issues;

    [BindProperty(SupportsGet = true)] public string IssueKey { get; set; } = "";

    public Issue Issue { get; private set; } = null!;

    public async Task<IActionResult> OnGetAsync()
    {
        try
        {
            await LoadProjectAsync();
            Issue = await _issues.GetAsync(Project, IssueKey);
            return Page();
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }
    }

    public async Task<IActionResult> OnPostAsync(string? status, string? priority, string? type, int? assigneeId)
    {
        try
        {
            await LoadProjectAsync();
            Issue = await _issues.GetAsync(Project, IssueKey);
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }

        try
        {
            Issue = await _issues.UpdateAsync(Project, IssueKey, new IssueUpdate
            {
                HasStatus = true, Status = status,
                HasPriority = true, Priority = priority,
                HasType = true, Type = type,
                HasAssignee = true, AssigneeId = assigneeId,
            });
            Flash = $"{Issue.Key} updated.";
            return Redirect($"/projects/{Project.Key}/issues/{Issue.Key}");
        }
        catch (AppException ex) when (ex.Status == 400)
        {
            Error = ex.Message;
            return Page();
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages.Projects;

public class IssuesModel : ProjectPageModel
{
    private readonly IssueService _issues;

    public IssuesModel(ProjectService projects, IssueService issues) : base(projects) => _issues = issues;

    [BindProperty(SupportsGet = true)] public string? Status { get; set; }

    public List<string> Selected { get; private set; } = new();
    public List<Issue> Issues { get; private set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        try
        {
            await LoadProjectAsync();
            Selected = IssueService.ParseKeys(Request.Query["issueKeys"]);
            var status = string.IsNullOrEmpty(Status) ? null : Status;
            Issues = await _issues.ListAsync(Project, status, Selected);
            return Page();
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }
    }
}

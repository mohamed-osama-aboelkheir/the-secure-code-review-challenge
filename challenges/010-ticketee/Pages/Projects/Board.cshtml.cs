using Microsoft.AspNetCore.Mvc;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages.Projects;

public class BoardModel : ProjectPageModel
{
    private readonly IssueService _issues;

    public BoardModel(ProjectService projects, IssueService issues) : base(projects) => _issues = issues;

    public List<Issue> Issues { get; private set; } = new();

    public async Task<IActionResult> OnGetAsync()
    {
        try
        {
            await LoadProjectAsync();
            Issues = await _issues.ListAsync(Project, null, Array.Empty<string>());
            return Page();
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }
    }

    public async Task<IActionResult> OnPostMoveAsync(string? issueKey, string? status)
    {
        try
        {
            await LoadProjectAsync();
            await _issues.UpdateAsync(Project, issueKey ?? "", new IssueUpdate { HasStatus = true, Status = status });
            return Redirect($"/projects/{Project.Key}");
        }
        catch (AppException ex) when (ex.Status == 400)
        {
            Flash = ex.Message;
            return Redirect($"/projects/{Project.Key}");
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }
    }
}

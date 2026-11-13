using Microsoft.AspNetCore.Mvc;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages.Projects;

public class ProjectsIndexModel : AppPageModel
{
    private readonly ProjectService _projects;
    public ProjectsIndexModel(ProjectService projects) => _projects = projects;

    public List<Project> ProjectList { get; private set; } = new();
    public Dictionary<int, int> IssueCounts { get; private set; } = new();

    [BindProperty] public string? Name { get; set; }
    [BindProperty] public string? Description { get; set; }

    public async Task OnGetAsync() => await LoadAsync();

    public async Task<IActionResult> OnPostAsync()
    {
        try
        {
            var project = await _projects.CreateAsync(UserId, Name, Description);
            Flash = $"Project {project.Name} created with key {project.Key}.";
            return Redirect($"/projects/{project.Key}");
        }
        catch (AppException ex)
        {
            Error = ex.Message;
            await LoadAsync();
            return Page();
        }
    }

    private async Task LoadAsync()
    {
        ProjectList = await _projects.ListForUserAsync(UserId);
        IssueCounts = await _projects.CountIssuesAsync(ProjectList);
    }
}

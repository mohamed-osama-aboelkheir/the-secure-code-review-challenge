using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Ticketee.Auth;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages;

public abstract class AppPageModel : PageModel
{
    protected int UserId => User.GetUserId();

    [TempData] public string? Flash { get; set; }
    public string? Error { get; set; }

    protected IActionResult StatusPage(AppException ex) => StatusCode(ex.Status);
}

public abstract class ProjectPageModel : AppPageModel
{
    protected readonly ProjectService Projects;
    protected ProjectPageModel(ProjectService projects) => Projects = projects;

    [BindProperty(SupportsGet = true)] public string Key { get; set; } = "";

    public Project Project { get; private set; } = null!;
    public List<User> Members { get; private set; } = new();
    public bool IsLead => Project.LeadId == UserId;

    protected async Task LoadProjectAsync()
    {
        Project = await Projects.RequireAccessAsync(Key.ToUpperInvariant(), UserId);
        Members = await Projects.ListMembersAsync(Project);
    }
}

public static class Ui
{
    public static string Initials(string? name)
    {
        var parts = (name ?? "?").Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length switch
        {
            0 => "?",
            1 => parts[0][..1].ToUpperInvariant(),
            _ => (parts[0][..1] + parts[^1][..1]).ToUpperInvariant(),
        };
    }

    public static string ColorClass(string seed)
    {
        var hash = 0;
        foreach (var c in seed) hash = unchecked(hash * 31 + c);
        return $"hue-{(uint)hash % 10}";
    }

    public static string Ago(DateTime utc)
    {
        var span = DateTime.UtcNow - utc;
        if (span.TotalMinutes < 1) return "just now";
        if (span.TotalHours < 1) return $"{(int)span.TotalMinutes}m ago";
        if (span.TotalDays < 1) return $"{(int)span.TotalHours}h ago";
        if (span.TotalDays < 30) return $"{(int)span.TotalDays}d ago";
        return utc.ToString("dd MMM yyyy");
    }

    public static string Capitalize(string value) =>
        value.Length == 0 ? value : char.ToUpperInvariant(value[0]) + value[1..];
}

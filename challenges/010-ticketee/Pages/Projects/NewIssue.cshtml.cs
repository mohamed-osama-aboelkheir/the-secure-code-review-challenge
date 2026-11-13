using Microsoft.AspNetCore.Html;
using Microsoft.AspNetCore.Mvc;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Pages.Projects;

public class NewIssueModel : ProjectPageModel
{
    private readonly IssueService _issues;
    private readonly MarkdownRenderer _markdown;

    public NewIssueModel(ProjectService projects, IssueService issues, MarkdownRenderer markdown) : base(projects)
    {
        _issues = issues;
        _markdown = markdown;
    }

    [BindProperty] public string? Title { get; set; }
    [BindProperty] public string? Body { get; set; }
    [BindProperty] public string? Type { get; set; } = IssueTypes.Task;
    [BindProperty] public string? Priority { get; set; } = IssuePriorities.Medium;
    [BindProperty] public int? AssigneeId { get; set; }

    public IHtmlContent? Preview { get; private set; }

    public IssueFormModel Form() => new()
    {
        Title = Title, Body = Body, Type = Type, Priority = Priority, AssigneeId = AssigneeId,
        Members = Members, Preview = Preview,
        CancelUrl = $"/projects/{Project.Key}", SubmitLabel = "Create issue",
    };

    public async Task<IActionResult> OnGetAsync()
    {
        try
        {
            await LoadProjectAsync();
            AssigneeId ??= UserId;
            return Page();
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }
    }

    public async Task<IActionResult> OnPostPreviewAsync()
    {
        try
        {
            await LoadProjectAsync();
            Preview = _markdown.Render(Body);
            if (string.IsNullOrWhiteSpace(Body)) Preview = new HtmlString("<p class=\"muted\">Nothing to preview.</p>");
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
            await LoadProjectAsync();
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }

        try
        {
            var issue = await _issues.CreateAsync(Project, UserId, new IssueInput(Title, Body, Type, Priority, AssigneeId));
            Flash = $"{issue.Key} created.";
            return Redirect($"/projects/{Project.Key}/issues/{issue.Key}");
        }
        catch (AppException ex) when (ex.Status == 400)
        {
            Error = ex.Message;
            return Page();
        }
    }
}

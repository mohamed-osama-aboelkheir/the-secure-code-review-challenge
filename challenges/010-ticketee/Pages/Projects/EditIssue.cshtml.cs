using Microsoft.AspNetCore.Html;
using Microsoft.AspNetCore.Mvc;
using Ticketee.Services;

namespace Ticketee.Pages.Projects;

public class EditIssueModel : ProjectPageModel
{
    private readonly IssueService _issues;
    private readonly MarkdownRenderer _markdown;

    public EditIssueModel(ProjectService projects, IssueService issues, MarkdownRenderer markdown) : base(projects)
    {
        _issues = issues;
        _markdown = markdown;
    }

    [BindProperty(SupportsGet = true)] public string IssueKey { get; set; } = "";
    [BindProperty] public string? Title { get; set; }
    [BindProperty] public string? Body { get; set; }
    [BindProperty] public string? Type { get; set; }
    [BindProperty] public string? Priority { get; set; }
    [BindProperty] public int? AssigneeId { get; set; }

    public IHtmlContent? Preview { get; private set; }

    public IssueFormModel Form() => new()
    {
        Title = Title, Body = Body, Type = Type, Priority = Priority, AssigneeId = AssigneeId,
        Members = Members, Preview = Preview,
        CancelUrl = $"/projects/{Project.Key}/issues/{IssueKey}", SubmitLabel = "Save issue",
    };

    public async Task<IActionResult> OnGetAsync()
    {
        try
        {
            await LoadProjectAsync();
            var issue = await _issues.GetAsync(Project, IssueKey);
            IssueKey = issue.Key;
            Title = issue.Title;
            Body = issue.Body;
            Type = issue.Type;
            Priority = issue.Priority;
            AssigneeId = issue.AssigneeId;
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
            await _issues.GetAsync(Project, IssueKey);
            Preview = string.IsNullOrWhiteSpace(Body)
                ? new HtmlString("<p class=\"muted\">Nothing to preview.</p>")
                : _markdown.Render(Body);
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
            await _issues.GetAsync(Project, IssueKey);
        }
        catch (AppException ex)
        {
            return StatusPage(ex);
        }

        try
        {
            var issue = await _issues.UpdateAsync(Project, IssueKey, new IssueUpdate
            {
                HasTitle = true, Title = Title,
                HasBody = true, Body = Body,
                HasType = true, Type = Type,
                HasPriority = true, Priority = Priority,
                HasAssignee = true, AssigneeId = AssigneeId,
            });
            Flash = $"{issue.Key} saved.";
            return Redirect($"/projects/{Project.Key}/issues/{issue.Key}");
        }
        catch (AppException ex) when (ex.Status == 400)
        {
            Error = ex.Message;
            return Page();
        }
    }
}

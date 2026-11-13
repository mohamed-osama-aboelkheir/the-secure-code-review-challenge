using Microsoft.AspNetCore.Html;
using Ticketee.Data;

namespace Ticketee.Pages.Projects;

public class IssueFormModel
{
    public string? Title { get; set; }
    public string? Body { get; set; }
    public string? Type { get; set; }
    public string? Priority { get; set; }
    public int? AssigneeId { get; set; }
    public List<User> Members { get; set; } = new();
    public IHtmlContent? Preview { get; set; }
    public string CancelUrl { get; set; } = "/projects";
    public string SubmitLabel { get; set; } = "Save";
}

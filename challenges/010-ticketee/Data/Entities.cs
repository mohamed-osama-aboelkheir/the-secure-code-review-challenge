using Microsoft.AspNetCore.Identity;

namespace Ticketee.Data;

public class User : IdentityUser<int>
{
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Project
{
    public int Id { get; set; }
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int LeadId { get; set; }
    public User? Lead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<ProjectMember> Members { get; set; } = new();
}

public class ProjectMember
{
    public int ProjectId { get; set; }
    public Project? Project { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class Invitation
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project? Project { get; set; }
    public string Email { get; set; } = "";
    public string Code { get; set; } = "";
    public int CreatedById { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Issue
{
    public string Key { get; set; } = "";
    public int ProjectId { get; set; }
    public Project? Project { get; set; }
    public string ProjectKey { get; set; } = "";
    public int Number { get; set; }
    public string Title { get; set; } = "";
    public string? Body { get; set; }
    public string Type { get; set; } = IssueTypes.Task;
    public string Priority { get; set; } = IssuePriorities.Medium;
    public string Status { get; set; } = IssueStatuses.Todo;
    public int? AssigneeId { get; set; }
    public User? Assignee { get; set; }
    public int ReporterId { get; set; }
    public User? Reporter { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class IssueStatuses
{
    public const string Todo = "todo";
    public const string InProgress = "in_progress";
    public const string Done = "done";
    public static readonly string[] All = { Todo, InProgress, Done };

    public static string Label(string status) => status switch
    {
        Todo => "To Do",
        InProgress => "In Progress",
        Done => "Done",
        _ => status,
    };
}

public static class IssueTypes
{
    public const string Task = "task";
    public const string Story = "story";
    public const string Bug = "bug";
    public static readonly string[] All = { Task, Story, Bug };
}

public static class IssuePriorities
{
    public const string Low = "low";
    public const string Medium = "medium";
    public const string High = "high";
    public const string Critical = "critical";
    public static readonly string[] All = { Low, Medium, High, Critical };
}

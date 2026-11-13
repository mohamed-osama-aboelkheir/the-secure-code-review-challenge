using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.RateLimiting;
using Ticketee.Auth;
using Ticketee.Data;
using Ticketee.Services;

namespace Ticketee.Api;

public record RegisterRequest(string? Email, string? Password, string? Name);
public record LoginRequest(string? Email, string? Password);
public record CreateProjectRequest(string? Name, string? Description);
public record InviteRequest(string? Email);
public record AcceptInvitationRequest(string? Code);
public record CreateIssueRequest(string? Title, string? Body, string? Type, string? Priority, int? AssigneeId);

public record UserDto(int Id, string Email, string Name)
{
    public static UserDto From(User u) => new(u.Id, u.Email ?? "", u.Name);
}

public record ProjectDto(int Id, string Key, string Name, string? Description, int LeadId, DateTime CreatedAt)
{
    public static ProjectDto From(Project p) => new(p.Id, p.Key, p.Name, p.Description, p.LeadId, p.CreatedAt);
}

public record IssueDto(
    string Key, int ProjectId, string ProjectKey, int Number, string Title, string? Body,
    string Type, string Priority, string Status, int? AssigneeId, int ReporterId,
    DateTime CreatedAt, DateTime UpdatedAt)
{
    public static IssueDto From(Issue i) => new(
        i.Key, i.ProjectId, i.ProjectKey, i.Number, i.Title, i.Body,
        i.Type, i.Priority, i.Status, i.AssigneeId, i.ReporterId, i.CreatedAt, i.UpdatedAt);
}

public class ApiExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is AppException ex)
        {
            context.Result = new ObjectResult(new { error = ex.Message }) { StatusCode = ex.Status };
            context.ExceptionHandled = true;
        }
    }
}

[ApiController]
[TypeFilter(typeof(ApiExceptionFilter))]
public abstract class ApiControllerBase : ControllerBase
{
    protected int UserId => User.GetUserId();
}

[Route("api/auth")]
[EnableRateLimiting("auth")]
public class AuthController : ApiControllerBase
{
    private readonly AuthService _auth;
    private readonly UserManager<User> _users;

    public AuthController(AuthService auth, UserManager<User> users)
    {
        _auth = auth;
        _users = users;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var user = await _auth.RegisterAsync(request.Email, request.Password, request.Name);
        return StatusCode(201, new
        {
            message = "User registered successfully",
            user = UserDto.From(user),
            token = await _auth.IssueApiTokenAsync(user),
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _auth.ValidateCredentialsAsync(request.Email, request.Password);
        return Ok(new
        {
            message = "Login successful",
            user = UserDto.From(user),
            token = await _auth.IssueApiTokenAsync(user),
        });
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var user = await _users.GetUserAsync(User) ?? throw AppException.Unauthorized("User not found");
        await _auth.SignOutEverywhereAsync(user);
        return Ok(new { message = "Logged out" });
    }
}

[Authorize]
[Route("api/projects")]
public class ProjectsController : ApiControllerBase
{
    private readonly ProjectService _projects;
    private readonly UserManager<User> _users;

    public ProjectsController(ProjectService projects, UserManager<User> users)
    {
        _projects = projects;
        _users = users;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectRequest request)
    {
        var project = await _projects.CreateAsync(UserId, request.Name, request.Description);
        return StatusCode(201, new { message = "Project created", project = ProjectDto.From(project) });
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var projects = await _projects.ListForUserAsync(UserId);
        return Ok(projects.Select(ProjectDto.From));
    }

    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key)
    {
        var project = await _projects.RequireAccessAsync(key, UserId);
        return Ok(ProjectDto.From(project));
    }

    [HttpGet("{key}/members")]
    public async Task<IActionResult> Members(string key)
    {
        var project = await _projects.RequireAccessAsync(key, UserId);
        var members = await _projects.ListMembersAsync(project);
        return Ok(members.Select(UserDto.From));
    }

    [HttpPost("{key}/invitations")]
    public async Task<IActionResult> Invite(string key, [FromBody] InviteRequest request)
    {
        var invitation = await _projects.InviteAsync(key, UserId, request.Email);
        return StatusCode(201, new
        {
            message = "Invitation created",
            invitationCode = invitation.Code,
            email = invitation.Email,
            projectKey = key,
        });
    }

    [HttpPost("invitations/accept")]
    public async Task<IActionResult> Accept([FromBody] AcceptInvitationRequest request)
    {
        var user = await _users.GetUserAsync(User) ?? throw AppException.Unauthorized("User not found");
        var project = await _projects.AcceptInvitationAsync(user, request.Code);
        return Ok(new { message = "Invitation accepted", projectKey = project.Key });
    }
}

[Authorize]
[Route("api/projects/{key}/issues")]
public class IssuesController : ApiControllerBase
{
    private readonly ProjectService _projects;
    private readonly IssueService _issues;

    public IssuesController(ProjectService projects, IssueService issues)
    {
        _projects = projects;
        _issues = issues;
    }

    [HttpGet]
    public async Task<IActionResult> List(string key, [FromQuery] string? status)
    {
        var project = await _projects.RequireAccessAsync(key, UserId);
        var issueKeys = IssueService.ParseKeys(Request.Query["issueKeys"]);
        var issues = await _issues.ListAsync(project, status, issueKeys);
        return Ok(issues.Select(IssueDto.From));
    }

    [HttpGet("{issueKey}")]
    public async Task<IActionResult> Get(string key, string issueKey)
    {
        var project = await _projects.RequireAccessAsync(key, UserId);
        var issue = await _issues.GetAsync(project, issueKey);
        return Ok(IssueDto.From(issue));
    }

    [HttpPost]
    public async Task<IActionResult> Create(string key, [FromBody] CreateIssueRequest request)
    {
        var project = await _projects.RequireAccessAsync(key, UserId);
        var issue = await _issues.CreateAsync(project, UserId,
            new IssueInput(request.Title, request.Body, request.Type, request.Priority, request.AssigneeId));
        return StatusCode(201, new { message = "Issue created", issue = IssueDto.From(issue) });
    }

    [HttpPatch("{issueKey}")]
    public async Task<IActionResult> Update(string key, string issueKey, [FromBody] JsonObject body)
    {
        var project = await _projects.RequireAccessAsync(key, UserId);
        var update = new IssueUpdate();

        try
        {
            if (body.TryGetPropertyValue("title", out var title)) { update.HasTitle = true; update.Title = title?.GetValue<string>(); }
            if (body.TryGetPropertyValue("body", out var text)) { update.HasBody = true; update.Body = text?.GetValue<string>(); }
            if (body.TryGetPropertyValue("type", out var type)) { update.HasType = true; update.Type = type?.GetValue<string>(); }
            if (body.TryGetPropertyValue("priority", out var priority)) { update.HasPriority = true; update.Priority = priority?.GetValue<string>(); }
            if (body.TryGetPropertyValue("status", out var status)) { update.HasStatus = true; update.Status = status?.GetValue<string>(); }
            if (body.TryGetPropertyValue("assigneeId", out var assignee)) { update.HasAssignee = true; update.AssigneeId = assignee?.GetValue<int>(); }
        }
        catch (Exception e) when (e is InvalidOperationException or FormatException)
        {
            throw AppException.BadRequest("Invalid field type");
        }

        var issue = await _issues.UpdateAsync(project, issueKey, update);
        return Ok(new { message = "Issue updated", issue = IssueDto.From(issue) });
    }
}

[Route("health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "OK", message = "Ticketee is running" });
}

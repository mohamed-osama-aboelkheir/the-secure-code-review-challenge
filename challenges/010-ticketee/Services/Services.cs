using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Ticketee.Auth;
using Ticketee.Data;
using Ticketee.Stores;

namespace Ticketee.Services;

public class AppException : Exception
{
    public int Status { get; }
    public AppException(int status, string message) : base(message) => Status = status;

    public static AppException BadRequest(string message) => new(400, message);
    public static AppException Unauthorized(string message) => new(401, message);
    public static AppException Forbidden(string message = "Forbidden") => new(403, message);
    public static AppException NotFound(string message) => new(404, message);
    public static AppException Conflict(string message) => new(409, message);
    public static AppException Gone(string message) => new(410, message);
}

public class AuthService
{
    private static readonly PasswordHasher<User> Hasher = new();
    private static readonly string DummyHash = Hasher.HashPassword(new User(), "ticketee-placeholder");

    private readonly UserManager<User> _users;
    private readonly SignInManager<User> _signIn;
    private readonly ApiTokenIssuer _tokens;

    public AuthService(UserManager<User> users, SignInManager<User> signIn, ApiTokenIssuer tokens)
    {
        _users = users;
        _signIn = signIn;
        _tokens = tokens;
    }

    public static string NormalizeEmail(string? email) => (email ?? "").Trim().ToLowerInvariant();

    public async Task<User> RegisterAsync(string? email, string? password, string? name)
    {
        email = NormalizeEmail(email);
        name = (name ?? "").Trim();

        if (email.Length == 0 || string.IsNullOrEmpty(password) || name.Length == 0)
            throw AppException.BadRequest("Email, password and name are required");
        if (email.Length > 255 || !email.Contains('@'))
            throw AppException.BadRequest("Enter a valid email address");
        if (name.Length > 100)
            throw AppException.BadRequest("Name must be 100 characters or fewer");
        if (password.Length > 128)
            throw AppException.BadRequest("Password must be 128 characters or fewer");

        var user = new User { UserName = email, Email = email, Name = name };
        var result = await _users.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName"))
                throw AppException.Conflict("Email already registered");
            throw AppException.BadRequest(string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        return user;
    }

    public async Task<User> ValidateCredentialsAsync(string? email, string? password)
    {
        email = NormalizeEmail(email);
        if (email.Length == 0 || string.IsNullOrEmpty(password))
            throw AppException.BadRequest("Email and password are required");

        var user = await _users.FindByEmailAsync(email);
        if (user is null)
        {
            Hasher.VerifyHashedPassword(new User(), DummyHash, password);
            throw AppException.Unauthorized("Invalid credentials");
        }

        var result = await _signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (result.IsLockedOut)
            throw new AppException(StatusCodes.Status429TooManyRequests, "Too many failed attempts. Try again later.");
        if (!result.Succeeded)
            throw AppException.Unauthorized("Invalid credentials");

        return user;
    }

    public Task<string> IssueApiTokenAsync(User user) => _tokens.IssueAsync(user);

    public Task SignInWebAsync(User user) => _signIn.SignInAsync(user, isPersistent: false);

    public async Task SignOutEverywhereAsync(User user)
    {
        await _users.UpdateSecurityStampAsync(user);
    }

    public async Task SignOutWebAsync(User? user)
    {
        if (user is not null) await SignOutEverywhereAsync(user);
        await _signIn.SignOutAsync();
    }
}

public class ProjectService
{
    private readonly ProjectStore _projects;
    private readonly InvitationStore _invitations;

    public ProjectService(ProjectStore projects, InvitationStore invitations)
    {
        _projects = projects;
        _invitations = invitations;
    }

    public static string DeriveKey(string name)
    {
        var letters = new string(name.Where(char.IsAsciiLetter).ToArray()).ToUpperInvariant();
        return (letters.Length > 4 ? letters[..4] : letters).PadRight(4, 'X');
    }

    public async Task<Project> CreateAsync(int userId, string? name, string? description)
    {
        name = (name ?? "").Trim();
        description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();

        if (name.Length == 0) throw AppException.BadRequest("Project name is required");
        if (name.Length > 200) throw AppException.BadRequest("Project name must be 200 characters or fewer");
        if (!name.Any(char.IsAsciiLetter)) throw AppException.BadRequest("Project name must contain letters");
        if (description?.Length > 1000) throw AppException.BadRequest("Description must be 1000 characters or fewer");

        return await _projects.CreateAsync(name, description, userId, DeriveKey(name));
    }

    public Task<List<Project>> ListForUserAsync(int userId) => _projects.ListForUserAsync(userId);

    public Task<Dictionary<int, int>> CountIssuesAsync(IEnumerable<Project> projects) =>
        _projects.CountIssuesAsync(projects.Select(p => p.Id));

    public async Task<Project> RequireAccessAsync(string key, int userId)
    {
        var project = await _projects.FindByKeyAsync(key);
        if (project is null) throw AppException.NotFound("Project not found");

        if (!await _projects.HasAccessAsync(userId, project.Id)) throw AppException.Forbidden();

        return project;
    }

    public Task<List<User>> ListMembersAsync(Project project) => _projects.ListMembersAsync(project.Id);

    public async Task<bool> IsMemberAsync(Project project, int userId) =>
        await _projects.HasAccessAsync(userId, project.Id);

    public async Task<Invitation> InviteAsync(string key, int userId, string? email)
    {
        email = AuthService.NormalizeEmail(email);
        if (email.Length == 0) throw AppException.BadRequest("Email is required");
        if (email.Length > 255 || !email.Contains('@')) throw AppException.BadRequest("Enter a valid email address");

        var project = await _projects.FindByKeyAsync(key);
        if (project is null) throw AppException.NotFound("Project not found");
        if (project.LeadId != userId) throw AppException.Forbidden("Only the project lead can send invitations");

        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        return await _invitations.CreateAsync(project.Id, email, code, userId);
    }

    public async Task<List<Invitation>> ListPendingInvitationsAsync(Project project, int userId)
    {
        if (project.LeadId != userId) return new List<Invitation>();
        return await _invitations.ListPendingAsync(project.Id);
    }

    public async Task<Project> AcceptInvitationAsync(User user, string? code)
    {
        code = (code ?? "").Trim();
        if (code.Length == 0) throw AppException.BadRequest("Invitation code is required");

        var invitation = await _invitations.FindByCodeAsync(code);
        if (invitation is null) throw AppException.NotFound("Invitation not found");
        if (invitation.AcceptedAt is not null) throw AppException.Gone("Invitation has already been used");
        if (!string.Equals(invitation.Email, user.Email ?? "", StringComparison.OrdinalIgnoreCase))
            throw AppException.Forbidden("This invitation was not issued to you");

        if (!await _invitations.AcceptAsync(invitation, user.Id))
            throw AppException.Gone("Invitation has already been used");

        return invitation.Project!;
    }
}

public record IssueInput(string? Title, string? Body, string? Type, string? Priority, int? AssigneeId);

public class IssueUpdate
{
    public bool HasTitle { get; set; }
    public string? Title { get; set; }
    public bool HasBody { get; set; }
    public string? Body { get; set; }
    public bool HasType { get; set; }
    public string? Type { get; set; }
    public bool HasPriority { get; set; }
    public string? Priority { get; set; }
    public bool HasStatus { get; set; }
    public string? Status { get; set; }
    public bool HasAssignee { get; set; }
    public int? AssigneeId { get; set; }
}

public class IssueService
{
    public const int MaxBodyLength = 20000;

    private readonly IssueStore _issues;
    private readonly ProjectService _projects;

    public IssueService(IssueStore issues, ProjectService projects)
    {
        _issues = issues;
        _projects = projects;
    }

    public static List<string> ParseKeys(IEnumerable<string?> values) =>
        values.Where(v => v is not null)
            .SelectMany(v => v!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Select(k => k.ToUpperInvariant())
            .Distinct()
            .Take(100)
            .ToList();

    public async Task<List<Issue>> ListAsync(Project project, string? status, IReadOnlyCollection<string> issueKeys)
    {
        if (status is not null && !IssueStatuses.All.Contains(status))
            throw AppException.BadRequest("Invalid status");

        if (issueKeys.Count > 0)
        {
            return await _issues.FindByKeysAsync(issueKeys);
        }

        return await _issues.ListByProjectAsync(project.Id, status);
    }

    public async Task<Issue> GetAsync(Project project, string issueKey)
    {
        var issue = await _issues.FindByKeyAsync(issueKey.ToUpperInvariant());
        if (issue is null || issue.ProjectId != project.Id)
            throw AppException.NotFound("Issue not found");
        return issue;
    }

    public async Task<Issue> CreateAsync(Project project, int reporterId, IssueInput input)
    {
        var title = ValidateTitle(input.Title);
        var body = ValidateBody(input.Body);
        var type = ValidateOption(input.Type ?? IssueTypes.Task, IssueTypes.All, "type");
        var priority = ValidateOption(input.Priority ?? IssuePriorities.Medium, IssuePriorities.All, "priority");
        await ValidateAssigneeAsync(project, input.AssigneeId);

        return await _issues.CreateAsync(project, new Issue
        {
            Title = title,
            Body = body,
            Type = type,
            Priority = priority,
            AssigneeId = input.AssigneeId,
            ReporterId = reporterId,
        });
    }

    public async Task<Issue> UpdateAsync(Project project, string issueKey, IssueUpdate update)
    {
        var issue = await GetAsync(project, issueKey);

        if (update.HasTitle) issue.Title = ValidateTitle(update.Title);
        if (update.HasBody) issue.Body = ValidateBody(update.Body);
        if (update.HasType) issue.Type = ValidateOption(update.Type, IssueTypes.All, "type");
        if (update.HasPriority) issue.Priority = ValidateOption(update.Priority, IssuePriorities.All, "priority");
        if (update.HasStatus) issue.Status = ValidateOption(update.Status, IssueStatuses.All, "status");
        if (update.HasAssignee)
        {
            await ValidateAssigneeAsync(project, update.AssigneeId);
            issue.AssigneeId = update.AssigneeId;
        }

        return await _issues.SaveAsync(issue);
    }

    private static string ValidateTitle(string? title)
    {
        title = (title ?? "").Trim();
        if (title.Length == 0) throw AppException.BadRequest("Title is required");
        if (title.Length > 200) throw AppException.BadRequest("Title must be 200 characters or fewer");
        return title;
    }

    private static string? ValidateBody(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        if (body.Length > MaxBodyLength) throw AppException.BadRequest($"Description must be {MaxBodyLength} characters or fewer");
        return body;
    }

    private static string ValidateOption(string? value, string[] allowed, string field)
    {
        if (value is null || !allowed.Contains(value)) throw AppException.BadRequest($"Invalid {field}");
        return value;
    }

    private async Task ValidateAssigneeAsync(Project project, int? assigneeId)
    {
        if (assigneeId is null) return;
        if (!await _projects.IsMemberAsync(project, assigneeId.Value))
            throw AppException.BadRequest("Assignee must be a member of the project");
    }
}

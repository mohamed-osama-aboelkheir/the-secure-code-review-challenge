using Microsoft.EntityFrameworkCore;
using Npgsql;
using Ticketee.Data;

namespace Ticketee.Stores;

public static class DbErrors
{
    public static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}

public class ProjectStore
{
    private readonly TicketeeDbContext _db;
    public ProjectStore(TicketeeDbContext db) => _db = db;

    public Task<Project?> FindByKeyAsync(string key) =>
        _db.Projects.AsNoTracking().Include(p => p.Lead).FirstOrDefaultAsync(p => p.Key == key);

    public Task<List<Project>> ListForUserAsync(int userId) =>
        _db.Projects.AsNoTracking()
            .Include(p => p.Lead)
            .Where(p => p.LeadId == userId || p.Members.Any(m => m.UserId == userId))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

    public Task<bool> HasAccessAsync(int userId, int projectId) =>
        _db.Projects.AnyAsync(p => p.Id == projectId &&
            (p.LeadId == userId || p.Members.Any(m => m.UserId == userId)));

    public Task<List<User>> ListMembersAsync(int projectId) =>
        _db.ProjectMembers.AsNoTracking()
            .Where(m => m.ProjectId == projectId)
            .OrderBy(m => m.JoinedAt)
            .Select(m => m.User!)
            .ToListAsync();

    public Task<Dictionary<int, int>> CountIssuesAsync(IEnumerable<int> projectIds)
    {
        var ids = projectIds.ToList();
        return _db.Issues.Where(i => ids.Contains(i.ProjectId))
            .GroupBy(i => i.ProjectId)
            .ToDictionaryAsync(g => g.Key, g => g.Count());
    }

    public async Task<Project> CreateAsync(string name, string? description, int leadId, string baseKey)
    {
        for (var attempt = 0; attempt < 100; attempt++)
        {
            var candidate = attempt == 0 ? baseKey : $"{baseKey}{attempt + 1}";
            if (await _db.Projects.AnyAsync(p => p.Key == candidate))
            {
                continue;
            }

            var project = new Project { Key = candidate, Name = name, Description = description, LeadId = leadId };
            project.Members.Add(new ProjectMember { UserId = leadId });
            _db.Projects.Add(project);
            try
            {
                await _db.SaveChangesAsync();
                return project;
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
            {
                _db.ChangeTracker.Clear();
            }
        }

        throw new InvalidOperationException("Unable to allocate a project key");
    }
}

public class InvitationStore
{
    private readonly TicketeeDbContext _db;
    public InvitationStore(TicketeeDbContext db) => _db = db;

    public async Task<Invitation> CreateAsync(int projectId, string email, string code, int createdBy)
    {
        var invitation = new Invitation { ProjectId = projectId, Email = email, Code = code, CreatedById = createdBy };
        _db.Invitations.Add(invitation);
        await _db.SaveChangesAsync();
        return invitation;
    }

    public Task<Invitation?> FindByCodeAsync(string code) =>
        _db.Invitations.AsNoTracking().Include(i => i.Project).FirstOrDefaultAsync(i => i.Code == code);

    public Task<List<Invitation>> ListPendingAsync(int projectId) =>
        _db.Invitations.AsNoTracking()
            .Where(i => i.ProjectId == projectId && i.AcceptedAt == null)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

    public async Task<bool> AcceptAsync(Invitation invitation, int userId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var updated = await _db.Invitations
            .Where(i => i.Id == invitation.Id && i.AcceptedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.AcceptedAt, DateTime.UtcNow));
        if (updated == 0)
        {
            return false;
        }

        var alreadyMember = await _db.ProjectMembers
            .AnyAsync(m => m.ProjectId == invitation.ProjectId && m.UserId == userId);
        if (!alreadyMember)
        {
            _db.ProjectMembers.Add(new ProjectMember { ProjectId = invitation.ProjectId, UserId = userId });
            await _db.SaveChangesAsync();
        }

        await tx.CommitAsync();
        return true;
    }
}

public class IssueStore
{
    private readonly TicketeeDbContext _db;
    public IssueStore(TicketeeDbContext db) => _db = db;

    private IQueryable<Issue> WithPeople() =>
        _db.Issues.Include(i => i.Assignee).Include(i => i.Reporter);

    public Task<Issue?> FindByKeyAsync(string key) =>
        WithPeople().FirstOrDefaultAsync(i => i.Key == key);

    public Task<List<Issue>> FindByKeysAsync(IReadOnlyCollection<string> keys) =>
        WithPeople().AsNoTracking()
            .Where(i => keys.Contains(i.Key))
            .OrderBy(i => i.ProjectKey).ThenBy(i => i.Number)
            .ToListAsync();

    public Task<List<Issue>> ListByProjectAsync(int projectId, string? status) =>
        WithPeople().AsNoTracking()
            .Where(i => i.ProjectId == projectId && (status == null || i.Status == status))
            .OrderBy(i => i.Number)
            .ToListAsync();

    public async Task<Issue> CreateAsync(Project project, Issue draft)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var next = (await _db.Issues.Where(i => i.ProjectId == project.Id)
                .MaxAsync(i => (int?)i.Number) ?? 0) + 1;

            var issue = new Issue
            {
                Key = $"{project.Key}-{next:D3}",
                ProjectId = project.Id,
                ProjectKey = project.Key,
                Number = next,
                Title = draft.Title,
                Body = draft.Body,
                Type = draft.Type,
                Priority = draft.Priority,
                AssigneeId = draft.AssigneeId,
                ReporterId = draft.ReporterId,
            };
            _db.Issues.Add(issue);
            try
            {
                await _db.SaveChangesAsync();
                return (await FindByKeyAsync(issue.Key))!;
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
            {
                _db.ChangeTracker.Clear();
            }
        }

        throw new InvalidOperationException("Unable to allocate an issue key");
    }

    public async Task<Issue> SaveAsync(Issue issue)
    {
        issue.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        return (await FindByKeyAsync(issue.Key))!;
    }
}

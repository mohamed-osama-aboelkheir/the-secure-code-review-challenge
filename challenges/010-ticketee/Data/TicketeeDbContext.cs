using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Ticketee.Data;

public class TicketeeDbContext : IdentityDbContext<User, IdentityRole<int>, int>
{
    public TicketeeDbContext(DbContextOptions<TicketeeDbContext> options) : base(options) { }

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<Issue> Issues => Set<Issue>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        base.OnModelCreating(model);

        model.Entity<User>(e =>
        {
            e.Property(u => u.Name).HasMaxLength(100).IsRequired();
            e.HasIndex(u => u.NormalizedEmail).HasDatabaseName("EmailIndex").IsUnique();
        });

        model.Entity<Project>(e =>
        {
            e.ToTable("projects");
            e.Property(p => p.Key).HasMaxLength(8).IsRequired();
            e.HasIndex(p => p.Key).IsUnique();
            e.Property(p => p.Name).HasMaxLength(200).IsRequired();
            e.Property(p => p.Description).HasMaxLength(1000);
            e.HasOne(p => p.Lead).WithMany().HasForeignKey(p => p.LeadId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<ProjectMember>(e =>
        {
            e.ToTable("project_members");
            e.HasKey(m => new { m.ProjectId, m.UserId });
            e.HasOne(m => m.Project).WithMany(p => p.Members).HasForeignKey(m => m.ProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<Invitation>(e =>
        {
            e.ToTable("invitations");
            e.Property(i => i.Email).HasMaxLength(255).IsRequired();
            e.Property(i => i.Code).HasMaxLength(64).IsRequired();
            e.HasIndex(i => i.Code).IsUnique();
            e.HasOne(i => i.Project).WithMany().HasForeignKey(i => i.ProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<User>().WithMany().HasForeignKey(i => i.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<Issue>(e =>
        {
            e.ToTable("issues");
            e.HasKey(i => i.Key);
            e.Property(i => i.Key).HasMaxLength(16);
            e.Property(i => i.ProjectKey).HasMaxLength(8).IsRequired();
            e.Property(i => i.Title).HasMaxLength(200).IsRequired();
            e.Property(i => i.Type).HasMaxLength(20).IsRequired();
            e.Property(i => i.Priority).HasMaxLength(20).IsRequired();
            e.Property(i => i.Status).HasMaxLength(20).IsRequired();
            e.HasIndex(i => new { i.ProjectId, i.Number }).IsUnique();
            e.HasOne(i => i.Project).WithMany().HasForeignKey(i => i.ProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(i => i.Assignee).WithMany().HasForeignKey(i => i.AssigneeId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(i => i.Reporter).WithMany().HasForeignKey(i => i.ReporterId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}

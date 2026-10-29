package com.projecthub.service;

import com.projecthub.model.Invitation;
import com.projecthub.model.Member;
import com.projecthub.model.Project;
import com.projecthub.model.User;
import com.projecthub.store.InvitationStore;
import com.projecthub.store.ProjectStore;
import com.projecthub.store.UserStore;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.projecthub.auth.ProjectAccess.isAdmin;
import static com.projecthub.auth.ProjectAccess.isMember;
import static com.projecthub.auth.ProjectAccess.roleOf;

@Service
public class ProjectService {

    public static final List<String> PROJECT_STATUSES = List.of("active", "on_hold", "completed");
    public static final List<String> MEMBER_ROLES = List.of("member", "admin");

    private final ProjectStore projects;
    private final UserStore users;
    private final InvitationStore invitations;
    private final ReportService reports;

    public ProjectService(ProjectStore projects, UserStore users, InvitationStore invitations, ReportService reports) {
        this.projects = projects;
        this.users = users;
        this.invitations = invitations;
        this.reports = reports;
    }

    public List<Project> listForUser(String userId) {
        return projects.findAllForUser(userId);
    }

    public Project create(String userId, String name, String description, String status) {
        if (name == null || name.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Project name is required");
        }
        if (status == null || status.isEmpty()) {
            status = "active";
        }
        if (!PROJECT_STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Status must be one of: " + String.join(", ", PROJECT_STATUSES));
        }

        User owner = users.findById(userId);
        String username = owner != null ? owner.getUsername() : null;
        return projects.create(name, description != null ? description : "", status, new Member(userId, username, "owner"));
    }

    public Project getForMember(String projectId, String userId) {
        Project project = projects.findById(projectId);
        if (project == null || !isMember(project, userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Project not found");
        }
        return project;
    }

    public void updateTemplate(String projectId, String userId, String template) {
        getForMember(projectId, userId);
        if (template == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Template is required");
        }
        projects.updateTemplate(projectId, template);
    }

    public String generateReport(String projectId, String userId, String template) {
        Project project = getForMember(projectId, userId);
        String templateSource = template != null ? template : project.getReportTemplate();
        if (templateSource == null || templateSource.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No template configured for this project");
        }
        return reports.render(templateSource, project);
    }

    public Invitation invite(String projectId, String userId, String username, String role) {
        Project project = requireAdmin(projectId, userId, "Only admins and owners can invite members");

        if (username == null || username.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Username is required");
        }
        if (role == null || role.isEmpty()) {
            role = "member";
        }
        requireValidRole(role);

        User target = users.findByUsername(username);
        if (target == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User not found");
        }
        if (isMember(project, target.getId())) {
            throw new ApiException(HttpStatus.CONFLICT, "User is already a member of this project");
        }
        if (invitations.findExisting(projectId, target.getId()) != null) {
            throw new ApiException(HttpStatus.CONFLICT, "User already has a pending invitation to this project");
        }

        return invitations.create(new Invitation(projectId, project.getName(), target.getId(), userId, role));
    }

    public void updateMemberRole(String projectId, String userId, String memberUserId, String role) {
        Project project = requireAdmin(projectId, userId, "Only admins and owners can update member roles");

        if ("owner".equals(roleOf(project, memberUserId))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Cannot change the owner role");
        }
        requireValidRole(role);
        if (!isMember(project, memberUserId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User is not a member of this project");
        }

        projects.updateMemberRole(projectId, memberUserId, role);
    }

    public void removeMember(String projectId, String userId, String memberUserId) {
        Project project = requireAdmin(projectId, userId, "Only admins and owners can remove members");

        if ("owner".equals(roleOf(project, memberUserId))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Cannot remove the project owner");
        }
        if (!isMember(project, memberUserId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "User is not a member of this project");
        }

        projects.removeMember(projectId, memberUserId);
    }

    private Project requireAdmin(String projectId, String userId, String message) {
        Project project = getForMember(projectId, userId);
        if (!isAdmin(project, userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, message);
        }
        return project;
    }

    private void requireValidRole(String role) {
        if (role == null || !MEMBER_ROLES.contains(role)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Role must be one of: " + String.join(", ", MEMBER_ROLES));
        }
    }
}

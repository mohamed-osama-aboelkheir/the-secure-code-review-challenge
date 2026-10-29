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

import static com.projecthub.auth.ProjectAccess.isMember;

@Service
public class InvitationService {

    private final InvitationStore invitations;
    private final ProjectStore projects;
    private final UserStore users;

    public InvitationService(InvitationStore invitations, ProjectStore projects, UserStore users) {
        this.invitations = invitations;
        this.projects = projects;
        this.users = users;
    }

    public List<Invitation> listPending(String userId) {
        return invitations.findPendingForUser(userId);
    }

    public Invitation accept(String invitationId, String userId) {
        Invitation invitation = requirePending(invitationId, userId);

        Project project = projects.findById(invitation.getProjectId());
        if (project != null && !isMember(project, userId)) {
            User user = users.findById(userId);
            projects.addMember(project.getId(), new Member(userId, user != null ? user.getUsername() : null, invitation.getRole()));
        }
        invitations.updateStatus(invitationId, "accepted");
        return invitation;
    }

    public void decline(String invitationId, String userId) {
        requirePending(invitationId, userId);
        invitations.updateStatus(invitationId, "declined");
    }

    private Invitation requirePending(String invitationId, String userId) {
        Invitation invitation = invitations.findById(invitationId);
        if (invitation == null || !invitation.getInvitedUserId().equals(userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Invitation not found");
        }
        if (!"pending".equals(invitation.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Invitation is no longer pending");
        }
        return invitation;
    }
}

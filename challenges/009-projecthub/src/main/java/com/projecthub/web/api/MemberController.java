package com.projecthub.web.api;

import com.projecthub.auth.CurrentUser;
import com.projecthub.model.Invitation;
import com.projecthub.model.Member;
import com.projecthub.service.ProjectService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects/{projectId}/members")
public class MemberController {

    public record InviteRequest(String username, String role) {
    }

    public record RoleRequest(String role) {
    }

    private final ProjectService projectService;

    public MemberController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public List<Member> list(@PathVariable String projectId) {
        return projectService.getForMember(projectId, CurrentUser.id()).getMembers();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> invite(@PathVariable String projectId, @RequestBody InviteRequest body) {
        Invitation invitation = projectService.invite(projectId, CurrentUser.id(), body.username(), body.role());
        return Map.of("id", invitation.getId(), "message", "Invitation sent to " + body.username());
    }

    @PatchMapping("/{memberUserId}")
    public Map<String, String> updateRole(@PathVariable String projectId, @PathVariable String memberUserId,
                                          @RequestBody RoleRequest body) {
        projectService.updateMemberRole(projectId, CurrentUser.id(), memberUserId, body.role());
        return Map.of("message", "Member role updated");
    }

    @DeleteMapping("/{memberUserId}")
    public Map<String, String> remove(@PathVariable String projectId, @PathVariable String memberUserId) {
        projectService.removeMember(projectId, CurrentUser.id(), memberUserId);
        return Map.of("message", "Member removed");
    }
}

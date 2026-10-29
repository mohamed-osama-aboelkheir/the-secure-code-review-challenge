package com.projecthub.web.api;

import com.projecthub.auth.CurrentUser;
import com.projecthub.model.Invitation;
import com.projecthub.service.InvitationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invitations")
public class InvitationController {

    private final InvitationService invitationService;

    public InvitationController(InvitationService invitationService) {
        this.invitationService = invitationService;
    }

    @GetMapping
    public List<Invitation> list() {
        return invitationService.listPending(CurrentUser.id());
    }

    @PostMapping("/{invitationId}/accept")
    public Map<String, String> accept(@PathVariable String invitationId) {
        Invitation invitation = invitationService.accept(invitationId, CurrentUser.id());
        return Map.of("message", "You have joined " + invitation.getProjectName());
    }

    @PostMapping("/{invitationId}/decline")
    public Map<String, String> decline(@PathVariable String invitationId) {
        invitationService.decline(invitationId, CurrentUser.id());
        return Map.of("message", "Invitation declined");
    }
}

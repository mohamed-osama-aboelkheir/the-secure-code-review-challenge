package com.projecthub.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("invitations")
public class Invitation {

    @Id
    private String id;

    private String projectId;
    private String projectName;
    private String invitedUserId;
    private String invitedBy;
    private String role;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;

    public Invitation() {
    }

    public Invitation(String projectId, String projectName, String invitedUserId, String invitedBy, String role) {
        this.projectId = projectId;
        this.projectName = projectName;
        this.invitedUserId = invitedUserId;
        this.invitedBy = invitedBy;
        this.role = role;
        this.status = "pending";
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public String getId() { return id; }
    public String getProjectId() { return projectId; }
    public String getProjectName() { return projectName; }
    public String getInvitedUserId() { return invitedUserId; }
    public String getInvitedBy() { return invitedBy; }
    public String getRole() { return role; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

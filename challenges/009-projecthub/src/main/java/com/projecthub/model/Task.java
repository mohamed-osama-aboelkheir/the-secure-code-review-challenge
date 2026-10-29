package com.projecthub.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("tasks")
public class Task {

    @Id
    private String id;

    @Indexed
    private String projectId;

    private String title;
    private String description;
    private String status;
    private String assignedTo;
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;

    public Task() {
    }

    public Task(String projectId, String title, String description, String status, String assignedTo, String createdBy) {
        this.projectId = projectId;
        this.title = title;
        this.description = description;
        this.status = status;
        this.assignedTo = assignedTo;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public String getId() { return id; }
    public String getProjectId() { return projectId; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getStatus() { return status; }
    public String getAssignedTo() { return assignedTo; }
    public String getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

package com.projecthub.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document("projects")
public class Project {

    @Id
    private String id;

    private String name;
    private String description;
    private String status;
    private List<Member> members = new ArrayList<>();
    private String reportTemplate;
    private Instant createdAt;

    public Project() {
    }

    public Project(String name, String description, String status, Member owner, String reportTemplate) {
        this.name = name;
        this.description = description;
        this.status = status;
        this.members.add(owner);
        this.reportTemplate = reportTemplate;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getStatus() { return status; }
    public List<Member> getMembers() { return members; }
    public String getReportTemplate() { return reportTemplate; }
    public Instant getCreatedAt() { return createdAt; }
}

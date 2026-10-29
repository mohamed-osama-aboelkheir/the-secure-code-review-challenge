package com.projecthub.web.api;

import com.projecthub.auth.CurrentUser;
import com.projecthub.model.Project;
import com.projecthub.service.ApiException;
import com.projecthub.service.ProjectService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    public record CreateProjectRequest(String name, String description, String status) {
    }

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public List<Project> list() {
        return projectService.listForUser(CurrentUser.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Project create(@RequestBody CreateProjectRequest body) {
        return projectService.create(CurrentUser.id(), body.name(), body.description(), body.status());
    }

    @GetMapping("/{projectId}")
    public Project get(@PathVariable String projectId) {
        return projectService.getForMember(projectId, CurrentUser.id());
    }

    @PutMapping("/{projectId}/template")
    public Map<String, String> updateTemplate(@PathVariable String projectId, @RequestBody Map<String, Object> body) {
        projectService.updateTemplate(projectId, CurrentUser.id(), optionalString(body, "template"));
        return Map.of("message", "Template updated");
    }

    @PostMapping("/{projectId}/report")
    public Map<String, String> generateReport(@PathVariable String projectId,
                                              @RequestBody(required = false) Map<String, Object> body) {
        String template = body != null ? optionalString(body, "template") : null;
        return Map.of("report", projectService.generateReport(projectId, CurrentUser.id(), template));
    }

    private static String optionalString(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (value != null && !(value instanceof String)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid input");
        }
        return (String) value;
    }
}

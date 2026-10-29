package com.projecthub.web.api;

import com.projecthub.auth.CurrentUser;
import com.projecthub.model.Task;
import com.projecthub.service.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/projects/{projectId}/tasks")
public class TaskController {

    public record CreateTaskRequest(String title, String description, String status, String assignedTo) {
    }

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<Task> list(@PathVariable String projectId) {
        return taskService.list(projectId, CurrentUser.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Task create(@PathVariable String projectId, @RequestBody CreateTaskRequest body) {
        return taskService.create(projectId, CurrentUser.id(), body.title(), body.description(), body.status(), body.assignedTo());
    }

    @GetMapping("/{taskId}")
    public Task get(@PathVariable String projectId, @PathVariable String taskId) {
        return taskService.get(projectId, taskId, CurrentUser.id());
    }

    @PutMapping("/{taskId}")
    public Task update(@PathVariable String projectId, @PathVariable String taskId, @RequestBody Map<String, Object> body) {
        return taskService.update(projectId, taskId, CurrentUser.id(), body);
    }

    @DeleteMapping("/{taskId}")
    public Map<String, String> delete(@PathVariable String projectId, @PathVariable String taskId) {
        taskService.delete(projectId, taskId, CurrentUser.id());
        return Map.of("message", "Task deleted");
    }
}

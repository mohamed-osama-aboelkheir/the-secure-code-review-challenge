package com.projecthub.service;

import com.projecthub.model.Project;
import com.projecthub.model.Task;
import com.projecthub.store.TaskStore;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.projecthub.auth.ProjectAccess.isMember;

@Service
public class TaskService {

    public static final List<String> TASK_STATUSES = List.of("todo", "in_progress", "done");

    private final TaskStore tasks;
    private final ProjectService projects;

    public TaskService(TaskStore tasks, ProjectService projects) {
        this.tasks = tasks;
        this.projects = projects;
    }

    public List<Task> list(String projectId, String userId) {
        projects.getForMember(projectId, userId);
        return tasks.findAllForProject(projectId);
    }

    public Task create(String projectId, String userId, String title, String description, String status, String assignedTo) {
        Project project = projects.getForMember(projectId, userId);

        if (title == null || title.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Task title is required");
        }
        if (status == null || status.isEmpty()) {
            status = "todo";
        }
        requireValidStatus(status);
        if (assignedTo != null && assignedTo.isEmpty()) {
            assignedTo = null;
        }
        requireAssignable(project, assignedTo);

        return tasks.create(new Task(projectId, title, description != null ? description : "", status, assignedTo, userId));
    }

    public Task get(String projectId, String taskId, String userId) {
        projects.getForMember(projectId, userId);
        return requireTaskInProject(projectId, taskId);
    }

    public Task update(String projectId, String taskId, String userId, Map<String, Object> body) {
        Project project = projects.getForMember(projectId, userId);
        requireTaskInProject(projectId, taskId);

        Map<String, Object> changes = new HashMap<>();
        if (body.containsKey("title")) {
            if (!(body.get("title") instanceof String title) || title.isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Task title is required");
            }
            changes.put("title", title);
        }
        if (body.containsKey("description")) {
            if (!(body.get("description") instanceof String description)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid input");
            }
            changes.put("description", description);
        }
        if (body.containsKey("status")) {
            if (!(body.get("status") instanceof String status)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid input");
            }
            requireValidStatus(status);
            changes.put("status", status);
        }
        if (body.containsKey("assigned_to")) {
            Object value = body.get("assigned_to");
            if (value != null && !(value instanceof String)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid assigned_to value");
            }
            String assignedTo = value == null || ((String) value).isEmpty() ? null : (String) value;
            requireAssignable(project, assignedTo);
            changes.put("assignedTo", assignedTo);
        }

        if (!changes.isEmpty()) {
            tasks.update(taskId, changes);
        }
        return tasks.findById(taskId);
    }

    public void delete(String projectId, String taskId, String userId) {
        projects.getForMember(projectId, userId);
        requireTaskInProject(projectId, taskId);
        tasks.delete(taskId);
    }

    private Task requireTaskInProject(String projectId, String taskId) {
        Task task = tasks.findById(taskId);
        if (task == null || !task.getProjectId().equals(projectId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Task not found");
        }
        return task;
    }

    private void requireValidStatus(String status) {
        if (!TASK_STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Status must be one of: " + String.join(", ", TASK_STATUSES));
        }
    }

    private void requireAssignable(Project project, String assignedTo) {
        if (assignedTo != null && !isMember(project, assignedTo)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Assigned user is not a member of this project");
        }
    }
}

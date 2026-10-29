package com.projecthub.web.pages;

import com.projecthub.auth.CurrentUser;
import com.projecthub.auth.JwtService;
import com.projecthub.config.JwtAuthFilter;
import com.projecthub.model.Member;
import com.projecthub.model.Project;
import com.projecthub.model.User;
import com.projecthub.service.ApiException;
import com.projecthub.service.AuthService;
import com.projecthub.service.InvitationService;
import com.projecthub.service.ProjectService;
import com.projecthub.service.TaskService;
import com.projecthub.store.UserStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.ModelAndView;

import java.time.Duration;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static com.projecthub.auth.ProjectAccess.isAdmin;

@Controller
public class PageController {

    private final AuthService authService;
    private final ProjectService projectService;
    private final TaskService taskService;
    private final InvitationService invitationService;
    private final UserStore users;

    public PageController(AuthService authService, ProjectService projectService, TaskService taskService,
                          InvitationService invitationService, UserStore users) {
        this.authService = authService;
        this.projectService = projectService;
        this.taskService = taskService;
        this.invitationService = invitationService;
        this.users = users;
    }

    @ModelAttribute("currentUser")
    public User currentUser() {
        return users.findById(CurrentUser.id());
    }

    @ModelAttribute("csrf")
    public CsrfToken csrf(CsrfToken token) {
        token.getToken();
        return token;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    @GetMapping("/")
    public String home() {
        return "redirect:/projects";
    }

    @GetMapping("/login")
    public String loginPage(@RequestParam(required = false) String registered, Model model) {
        model.addAttribute("registered", registered != null);
        return "login";
    }

    @PostMapping("/login")
    public String login(@RequestParam String username, @RequestParam String password,
                        HttpServletResponse response, Model model) {
        try {
            String token = authService.login(username, password);
            setTokenCookie(response, token, JwtService.TOKEN_TTL);
            return "redirect:/projects";
        } catch (ApiException e) {
            model.addAttribute("error", e.getMessage());
            model.addAttribute("username", username);
            return "login";
        }
    }

    @GetMapping("/register")
    public String registerPage() {
        return "register";
    }

    @PostMapping("/register")
    public String register(@RequestParam String username, @RequestParam String password, Model model) {
        try {
            authService.register(username, password);
            return "redirect:/login?registered";
        } catch (ApiException e) {
            model.addAttribute("error", e.getMessage());
            model.addAttribute("username", username);
            return "register";
        }
    }

    @PostMapping("/logout")
    public String logout(HttpServletResponse response) {
        setTokenCookie(response, "", Duration.ZERO);
        return "redirect:/login";
    }

    // ── Projects ──────────────────────────────────────────────────────────────

    @GetMapping("/projects")
    public String projects(Model model) {
        model.addAttribute("projects", projectService.listForUser(CurrentUser.id()));
        model.addAttribute("projectStatuses", ProjectService.PROJECT_STATUSES);
        return "projects";
    }

    @PostMapping("/projects")
    public String createProject(@RequestParam String name, @RequestParam(defaultValue = "") String description,
                                @RequestParam(defaultValue = "active") String status, Model model) {
        try {
            Project project = projectService.create(CurrentUser.id(), name, description, status);
            return "redirect:/projects/" + project.getId();
        } catch (ApiException e) {
            model.addAttribute("error", e.getMessage());
            return projects(model);
        }
    }

    @GetMapping("/projects/{projectId}")
    public String project(@PathVariable String projectId, Model model) {
        return projectPage(projectId, model);
    }

    @PostMapping("/projects/{projectId}/template")
    public String saveTemplate(@PathVariable String projectId, @RequestParam String template, Model model) {
        model.addAttribute("templateDraft", template);
        return act(projectId, model, () -> projectService.updateTemplate(projectId, CurrentUser.id(), template));
    }

    @PostMapping("/projects/{projectId}/report")
    public String generateReport(@PathVariable String projectId, @RequestParam String template, Model model) {
        model.addAttribute("templateDraft", template);
        try {
            model.addAttribute("report", projectService.generateReport(projectId, CurrentUser.id(), template));
        } catch (ApiException e) {
            if (e.getStatus() == HttpStatus.NOT_FOUND) {
                throw e;
            }
            model.addAttribute("error", e.getMessage());
        }
        return projectPage(projectId, model);
    }

    // ── Members ───────────────────────────────────────────────────────────────

    @PostMapping("/projects/{projectId}/members")
    public String invite(@PathVariable String projectId, @RequestParam String username,
                         @RequestParam(defaultValue = "member") String role, Model model) {
        return act(projectId, model, () -> projectService.invite(projectId, CurrentUser.id(), username, role));
    }

    @PostMapping("/projects/{projectId}/members/{memberUserId}/role")
    public String updateMemberRole(@PathVariable String projectId, @PathVariable String memberUserId,
                                   @RequestParam String role, Model model) {
        return act(projectId, model, () -> projectService.updateMemberRole(projectId, CurrentUser.id(), memberUserId, role));
    }

    @PostMapping("/projects/{projectId}/members/{memberUserId}/remove")
    public String removeMember(@PathVariable String projectId, @PathVariable String memberUserId, Model model) {
        return act(projectId, model, () -> projectService.removeMember(projectId, CurrentUser.id(), memberUserId));
    }

    // ── Tasks ─────────────────────────────────────────────────────────────────

    @PostMapping("/projects/{projectId}/tasks")
    public String createTask(@PathVariable String projectId, @RequestParam String title,
                             @RequestParam(defaultValue = "") String description,
                             @RequestParam(defaultValue = "todo") String status,
                             @RequestParam(name = "assigned_to", defaultValue = "") String assignedTo, Model model) {
        return act(projectId, model,
                () -> taskService.create(projectId, CurrentUser.id(), title, description, status, assignedTo));
    }

    @PostMapping("/projects/{projectId}/tasks/{taskId}")
    public String updateTask(@PathVariable String projectId, @PathVariable String taskId,
                             @RequestParam String title, @RequestParam(defaultValue = "") String description,
                             @RequestParam String status,
                             @RequestParam(name = "assigned_to", defaultValue = "") String assignedTo, Model model) {
        Map<String, Object> fields = new HashMap<>();
        fields.put("title", title);
        fields.put("description", description);
        fields.put("status", status);
        fields.put("assigned_to", assignedTo);
        return act(projectId, model, () -> taskService.update(projectId, taskId, CurrentUser.id(), fields));
    }

    @PostMapping("/projects/{projectId}/tasks/{taskId}/delete")
    public String deleteTask(@PathVariable String projectId, @PathVariable String taskId, Model model) {
        return act(projectId, model, () -> taskService.delete(projectId, taskId, CurrentUser.id()));
    }

    // ── Invitations ───────────────────────────────────────────────────────────

    @GetMapping("/invitations")
    public String invitations(Model model) {
        model.addAttribute("invitations", invitationService.listPending(CurrentUser.id()));
        return "invitations";
    }

    @PostMapping("/invitations/{invitationId}/accept")
    public String acceptInvitation(@PathVariable String invitationId, Model model) {
        try {
            return "redirect:/projects/" + invitationService.accept(invitationId, CurrentUser.id()).getProjectId();
        } catch (ApiException e) {
            model.addAttribute("error", e.getMessage());
            return invitations(model);
        }
    }

    @PostMapping("/invitations/{invitationId}/decline")
    public String declineInvitation(@PathVariable String invitationId, Model model) {
        try {
            invitationService.decline(invitationId, CurrentUser.id());
            return "redirect:/invitations";
        } catch (ApiException e) {
            model.addAttribute("error", e.getMessage());
            return invitations(model);
        }
    }

    @ExceptionHandler(ApiException.class)
    public ModelAndView notFound(ApiException e, HttpServletRequest request) {
        ModelAndView view = new ModelAndView("not-found", HttpStatus.NOT_FOUND);
        view.addObject("message", e.getMessage());
        view.addObject("currentUser", currentUser());
        view.addObject("csrf", csrf((CsrfToken) request.getAttribute(CsrfToken.class.getName())));
        return view;
    }

    private String act(String projectId, Model model, Runnable action) {
        try {
            action.run();
            return "redirect:/projects/" + projectId;
        } catch (ApiException e) {
            if (e.getStatus() == HttpStatus.NOT_FOUND && "Project not found".equals(e.getMessage())) {
                throw e;
            }
            model.addAttribute("error", e.getMessage());
            return projectPage(projectId, model);
        }
    }

    private String projectPage(String projectId, Model model) {
        String userId = CurrentUser.id();
        Project project = projectService.getForMember(projectId, userId);

        Map<String, String> memberNames = new LinkedHashMap<>();
        for (Member member : project.getMembers()) {
            memberNames.put(member.getUserId(), member.getUsername());
        }

        model.addAttribute("project", project);
        model.addAttribute("tasks", taskService.list(projectId, userId));
        model.addAttribute("memberNames", memberNames);
        model.addAttribute("canManage", isAdmin(project, userId));
        model.addAttribute("taskStatuses", TaskService.TASK_STATUSES);
        model.addAttribute("memberRoles", ProjectService.MEMBER_ROLES);
        if (!model.containsAttribute("templateDraft")) {
            model.addAttribute("templateDraft", project.getReportTemplate());
        }
        return "project";
    }

    private void setTokenCookie(HttpServletResponse response, String value, Duration maxAge) {
        ResponseCookie cookie = ResponseCookie.from(JwtAuthFilter.COOKIE_NAME, value)
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}

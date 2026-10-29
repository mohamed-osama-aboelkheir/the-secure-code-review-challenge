package com.projecthub.web.api;

import com.projecthub.model.User;
import com.projecthub.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record Credentials(String username, String password) {
    }

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> register(@RequestBody Credentials body) {
        User user = authService.register(body.username(), body.password());
        return Map.of("id", user.getId(), "username", user.getUsername());
    }

    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Credentials body) {
        return Map.of("token", authService.login(body.username(), body.password()));
    }
}

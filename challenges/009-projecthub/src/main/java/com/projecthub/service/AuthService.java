package com.projecthub.service;

import com.projecthub.auth.JwtService;
import com.projecthub.model.User;
import com.projecthub.store.UserStore;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserStore users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserStore users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public User register(String username, String password) {
        if (isBlank(username) || isBlank(password)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Username and password are required");
        }
        if (username.length() < 3 || username.length() > 32) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Username must be between 3 and 32 characters");
        }
        if (password.length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
        }

        User user = users.findByUsername(username) == null
                ? users.create(username, passwordEncoder.encode(password))
                : null;
        if (user == null) {
            throw new ApiException(HttpStatus.CONFLICT, "Username already taken");
        }
        return user;
    }

    public String login(String username, String password) {
        if (isBlank(username) || isBlank(password)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Username and password are required");
        }

        User user = users.findByUsername(username);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return jwtService.issue(user.getId());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isEmpty();
    }
}

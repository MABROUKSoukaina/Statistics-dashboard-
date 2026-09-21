package com.ifnstats.controller;

import com.ifnstats.entity.AppUser;
import com.ifnstats.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** User management — ADMIN only (enforced in SecurityConfig + @PreAuthorize). */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    record UserView(Long id, String username, String fullName, String role, boolean enabled) {
        static UserView of(AppUser u) {
            return new UserView(u.getId(), u.getUsername(), u.getFullName(), u.getRole(), u.isEnabled());
        }
    }

    record CreateRequest(String username, String password, String fullName, String role) {}
    record UpdateRequest(String fullName, String role, Boolean enabled) {}
    record PasswordRequest(String password) {}

    @GetMapping
    public List<UserView> list() {
        return service.findAll().stream().map(UserView::of).toList();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateRequest req) {
        try {
            AppUser u = service.create(req.username(), req.password(), req.fullName(), req.role());
            return ResponseEntity.ok(UserView.of(u));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody UpdateRequest req) {
        try {
            AppUser u = service.update(id, req.fullName(), req.role(), req.enabled());
            return ResponseEntity.ok(UserView.of(u));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody PasswordRequest req) {
        try {
            service.resetPassword(id, req.password());
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }
}

package com.ifnstats.service;

import com.ifnstats.entity.AppUser;
import com.ifnstats.repository.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class UserService {

    private static final Set<String> VALID_ROLES = Set.of("ADMIN", "VIEWER");

    private final AppUserRepository repo;
    private final PasswordEncoder encoder;

    public UserService(AppUserRepository repo, PasswordEncoder encoder) {
        this.repo = repo;
        this.encoder = encoder;
    }

    public List<AppUser> findAll() {
        return repo.findAll();
    }

    public Optional<AppUser> findByUsername(String username) {
        return repo.findByUsername(username);
    }

    /** Returns the user if username exists, is enabled, and the raw password matches. */
    public Optional<AppUser> authenticate(String username, String rawPassword) {
        return repo.findByUsername(username)
                .filter(AppUser::isEnabled)
                .filter(u -> encoder.matches(rawPassword, u.getPasswordHash()));
    }

    public AppUser create(String username, String rawPassword, String fullName, String role) {
        validateRole(role);
        if (repo.existsByUsername(username)) {
            throw new IllegalArgumentException("Nom d'utilisateur déjà utilisé: " + username);
        }
        if (rawPassword == null || rawPassword.length() < 4) {
            throw new IllegalArgumentException("Mot de passe trop court (min 4 caractères)");
        }
        AppUser u = new AppUser();
        u.setUsername(username);
        u.setPasswordHash(encoder.encode(rawPassword));
        u.setFullName(fullName);
        u.setRole(role);
        u.setEnabled(true);
        return repo.save(u);
    }

    public AppUser update(Long id, String fullName, String role, Boolean enabled) {
        AppUser u = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable: " + id));
        if (role != null) {
            validateRole(role);
            u.setRole(role);
        }
        if (fullName != null) u.setFullName(fullName);
        if (enabled != null) u.setEnabled(enabled);
        return repo.save(u);
    }

    public void resetPassword(Long id, String rawPassword) {
        AppUser u = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable: " + id));
        if (rawPassword == null || rawPassword.length() < 4) {
            throw new IllegalArgumentException("Mot de passe trop court (min 4 caractères)");
        }
        u.setPasswordHash(encoder.encode(rawPassword));
        repo.save(u);
    }

    public void delete(Long id) {
        repo.deleteById(id);
    }

    private void validateRole(String role) {
        if (role == null || !VALID_ROLES.contains(role)) {
            throw new IllegalArgumentException("Rôle invalide: " + role + " (attendu: " + VALID_ROLES + ")");
        }
    }
}

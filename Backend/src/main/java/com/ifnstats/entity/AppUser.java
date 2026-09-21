package com.ifnstats.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Application user for this stats-only dashboard.
 *
 * Only two roles here, since this app is read-only:
 *   ADMIN  - can manage users (create/disable/reset password), sees everything
 *   VIEWER - read-only access to the stats/map endpoints
 *
 * Passwords are never stored in application.properties (see the main dashboard's
 * historical hard-coded accounts for what NOT to do) — every account after the
 * first bootstrap admin is created via POST /api/users and stored here, hashed.
 */
@Entity
@Table(name = "stats_app_user")
@Getter
@Setter
@NoArgsConstructor
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", length = 100, nullable = false, unique = true)
    private String username;

    @Column(name = "password_hash", length = 200, nullable = false)
    private String passwordHash;

    @Column(name = "full_name", length = 200)
    private String fullName;

    /** ADMIN | VIEWER */
    @Column(name = "role", length = 30, nullable = false)
    private String role = "VIEWER";

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}

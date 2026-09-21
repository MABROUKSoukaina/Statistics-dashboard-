package com.ifnstats.config;

import com.ifnstats.entity.AppUser;
import com.ifnstats.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Bootstraps the {@code stats_app_user} table and seeds exactly one admin account,
 * only if the table is empty (first run). Every other account is created afterwards
 * from the app itself (POST /api/users, ADMIN only) and stored here, hashed — never
 * added to application.properties.
 */
@Component
public class UserDataInitializer implements CommandLineRunner {

    private final JdbcTemplate jdbc;
    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final String bootstrapUsername;
    private final String bootstrapPassword;

    public UserDataInitializer(
            JdbcTemplate jdbc,
            AppUserRepository users,
            PasswordEncoder encoder,
            @Value("${app.bootstrap.username}") String bootstrapUsername,
            @Value("${app.bootstrap.password}") String bootstrapPassword) {
        this.jdbc = jdbc;
        this.users = users;
        this.encoder = encoder;
        this.bootstrapUsername = bootstrapUsername;
        this.bootstrapPassword = bootstrapPassword;
    }

    @Override
    public void run(String... args) {
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS stats_app_user (
                id            BIGSERIAL    PRIMARY KEY,
                username      VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(200) NOT NULL,
                full_name     VARCHAR(200),
                role          VARCHAR(30)  NOT NULL DEFAULT 'VIEWER',
                enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
                created_at    TIMESTAMP    NOT NULL DEFAULT now()
            )
            """);

        if (users.count() == 0) {
            AppUser admin = new AppUser();
            admin.setUsername(bootstrapUsername);
            admin.setPasswordHash(encoder.encode(bootstrapPassword));
            admin.setFullName("Administrateur");
            admin.setRole("ADMIN");
            admin.setEnabled(true);
            users.save(admin);
        }
    }
}

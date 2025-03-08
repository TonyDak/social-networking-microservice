package com.example.userservice.repository;

import com.example.userservice.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    User findByEmail(String email);
    User findByUsername(String username);
    Optional<User> findByKeycloakId(String keycloakId);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
}
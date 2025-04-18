package com.example.userservice.repository;

import com.example.userservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    User findByEmail(String email);
    Optional<User> findByKeycloakId(String keycloakId);
    boolean existsByEmail(String email);
    boolean existsByPhoneNumber(String phoneNumber);
    @Query(value = "SELECT * FROM users WHERE phone_number = ?1", nativeQuery = true)
    Optional<User> findByPhoneNumber(String phoneNumber);
}
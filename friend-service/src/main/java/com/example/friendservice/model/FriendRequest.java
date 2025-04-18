package com.example.friendservice.model;

import lombok.*;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.Date;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "friend_requests")
public class FriendRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sender_id", nullable = false)
    private String senderId;

    @Column(name = "receiver_id", nullable = false)
    private String receiverId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private RequestStatus status = RequestStatus.PENDING;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum RequestStatus {
        PENDING, ACCEPTED, REJECTED, CANCELED
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

}
package com.example.friendservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendRequestDTO {
    private Long id;
    private String senderId;
    private String receiverId;
    private String status;
    private String message;
    private LocalDateTime createdAt;
}
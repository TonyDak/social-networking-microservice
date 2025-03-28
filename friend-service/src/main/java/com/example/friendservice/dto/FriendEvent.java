package com.example.friendservice.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FriendEvent {
    private String type;
    private String senderId;
    private String receiverId;
    private LocalDateTime timestamp;
}

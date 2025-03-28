package com.example.notificationservice.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
public class Notification implements Serializable {
    private String id;
    private String userId;
    private String senderId;
    private String messageId;
    private String conversationId;
    private String content;
    private String type;
    private LocalDateTime createdAt;
    private boolean read;
}
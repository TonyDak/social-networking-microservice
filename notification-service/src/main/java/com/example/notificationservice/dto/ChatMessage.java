package com.example.notificationservice.dto;

import lombok.Data;

@Data
public class ChatMessage {
    private String id;
    private String senderId;
    private String receiverId;
    private String conversationId;
    private String content;
    private String type;
    private String timestamp;
}

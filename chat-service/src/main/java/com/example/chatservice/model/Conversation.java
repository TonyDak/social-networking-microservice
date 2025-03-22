package com.example.chatservice.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "conversations")
public class Conversation {
    @Id
    private String id;
    private String name;
    private List<String> participants;
    private String type; // ONE_TO_ONE, GROUP
    private String creatorId;
    private LocalDateTime createdAt;
    private LocalDateTime lastActivity;
    private String lastMessageId;
    private String lastMessageContent;
    private String lastMessageSenderId;

    public void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
        this.createdAt = LocalDateTime.now();
        this.lastActivity = LocalDateTime.now();
    }
}
package com.example.chatservice.model;

import jakarta.persistence.PrePersist;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@Document(collection = "chat_message")
@NoArgsConstructor
public class ChatMessage {
    @Id
    private String id;
    private String conversationId;
    private String senderId;
    private String receiverId;
    private String content;
    private LocalDateTime timestamp;
    private String status;
    private String type; // text, image, video, etc.
    private String fileName;

    @PrePersist
    public void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
}

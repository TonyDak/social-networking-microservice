package com.example.chatservice.controller;

import com.example.chatservice.model.ChatMessage;
import com.example.chatservice.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/chat")
public class ChatController {
    private final ChatService chatService;

    @Autowired
    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/messages")
    public ResponseEntity<ChatMessage> sendMessage(@RequestBody ChatMessage chatMessage) {
        chatService.sendMessage(chatMessage);
        return ResponseEntity.ok(chatMessage);
    }

    @GetMapping("/conversations/{userId1}/{userId2}")
    public ResponseEntity<List<ChatMessage>> getConversation(
            @PathVariable String userId1,
            @PathVariable String userId2) {
        return ResponseEntity.ok(chatService.getConversationMessages(userId1, userId2));
    }

    @GetMapping("/messages/{conversationId}")
    public ResponseEntity<List<ChatMessage>> getMessagesByConversationId(
            @PathVariable String conversationId) {
        return ResponseEntity.ok(chatService.getMessagesByConversationId(conversationId));
    }

    @GetMapping("/recent/{userId}")
    public ResponseEntity<List<ChatMessage>> getRecentMessages(
            @PathVariable String userId,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(chatService.getRecentMessages(userId, limit));
    }

    @GetMapping("/unread/{userId}")
    public ResponseEntity<List<ChatMessage>> getUnreadMessages(@PathVariable String userId) {
        return ResponseEntity.ok(chatService.getUnreadMessages(userId));
    }

    @PutMapping("/messages/{messageId}/read")
    public ResponseEntity<ChatMessage> markMessageAsRead(@PathVariable String messageId) {
        return ResponseEntity.ok(chatService.markAsRead(messageId));
    }

    @PutMapping("/conversations/{senderId}/{receiverId}/read")
    public ResponseEntity<?> markAllAsRead(
            @PathVariable String senderId,
            @PathVariable String receiverId) {
        chatService.markAllMessagesAsRead(senderId, receiverId);
        return ResponseEntity.ok().build();
    }
}
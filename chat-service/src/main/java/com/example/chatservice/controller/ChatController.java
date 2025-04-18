package com.example.chatservice.controller;

import com.example.chatservice.model.ChatMessage;
import com.example.chatservice.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/")
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


}
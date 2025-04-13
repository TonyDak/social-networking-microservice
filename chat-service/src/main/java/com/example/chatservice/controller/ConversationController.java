package com.example.chatservice.controller;

import com.example.chatservice.model.Conversation;
import com.example.chatservice.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ChatService chatService;

    @GetMapping
    public ResponseEntity<List<Conversation>> getUserConversations(Principal principal) {
        return ResponseEntity.ok(chatService.getUserConversations(principal.getName()));
    }

    @PostMapping("/group")
    public ResponseEntity<Conversation> createGroupConversation(
            @RequestBody Map<String, Object> payload,
            Principal principal) {
        String name = (String) payload.get("name");
        @SuppressWarnings("unchecked")
        List<String> participants = (List<String>) payload.get("participants");

        Conversation conversation = chatService.createGroupConversation(
                name, principal.getName(), participants);

        return ResponseEntity.ok(conversation);
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<?> getConversationMessages(
            @PathVariable String conversationId,
            Principal principal) {
        return ResponseEntity.ok(chatService.getMessagesByConversationId(conversationId));
    }
}
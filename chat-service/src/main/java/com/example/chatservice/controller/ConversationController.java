package com.example.chatservice.controller;

import com.example.chatservice.model.ChatMessage;
import com.example.chatservice.model.Conversation;
import com.example.chatservice.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class ConversationController {

    private final ChatService chatService;

    @GetMapping("/conversations")
    public ResponseEntity<List<Conversation>> getUserConversations(Principal principal) {
        return ResponseEntity.ok(chatService.getUserConversations(principal.getName()));
    }
    @GetMapping("/conversations/{userId1}/{userId2}")
    public ResponseEntity<List<ChatMessage>> getConversation(
            @PathVariable String userId1,
            @PathVariable String userId2) {
        return ResponseEntity.ok(chatService.getConversationMessages(userId1, userId2));
    }
    @PutMapping("/conversations/{senderId}/{receiverId}/read")
    public ResponseEntity<?> markAllAsRead(
            @PathVariable String senderId,
            @PathVariable String receiverId) {
        chatService.markAllMessagesAsRead(senderId, receiverId);
        return ResponseEntity.ok().build();
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
    @PostMapping("/{conversationId}/members")
    public ResponseEntity<Conversation> addMembersToGroup(
            @PathVariable String conversationId,
            @RequestBody Map<String, Object> payload,
            Principal principal) {
        @SuppressWarnings("unchecked")
        List<String> newMembers = (List<String>) payload.get("members");

        Conversation updatedConversation = chatService.addMembersToGroup(
                conversationId, principal.getName(), newMembers);

        return ResponseEntity.ok(updatedConversation);
    }
    @DeleteMapping("/{conversationId}/members/{memberId}")
    public ResponseEntity<Conversation> removeMemberFromGroup(
            @PathVariable String conversationId,
            @PathVariable String memberId,
            Principal principal) {

        Conversation updatedConversation = chatService.removeMemberFromGroup(
                conversationId, principal.getName(), memberId);

        return ResponseEntity.ok(updatedConversation);
    }

    @PostMapping("/{conversationId}/join")
    public ResponseEntity<Conversation> joinGroup(
            @PathVariable String conversationId,
            Principal principal) {

        Conversation conversation = chatService.joinGroup(conversationId, principal.getName());

        return ResponseEntity.ok(conversation);
    }
}
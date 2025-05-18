package com.example.chatservice.controller;

import com.example.chatservice.dto.MembersRequest;
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

    @GetMapping("/conversations/group")
    public ResponseEntity<List<Conversation>> getGroupConversations(Principal principal) {
        return ResponseEntity.ok(chatService.getGroupConversations(principal.getName()));
    }

    @PostMapping("/group")
    public ResponseEntity<Conversation> createGroupConversation(
            @RequestBody Map<String, Object> payload,
            Principal principal) {
        Map<String, Object> nameObj = (Map<String, Object>) payload.get("name");
        String name = (String) nameObj.get("name");
        List<String> participants = (List<String>) nameObj.get("participantIds");

        Conversation conversation = chatService.createGroupConversation(
                name, principal.getName(), participants);

        return ResponseEntity.ok(conversation);
    }

    @PostMapping("/{conversationId}/members")
    public ResponseEntity<Conversation> addMembersToGroup(
            @PathVariable String conversationId,
            @RequestBody MembersRequest request,
            Principal principal) {

        List<String> newMembers = request.getMembers();
        List<String> nameObj = request.getFullName();

        Conversation updatedConversation = chatService.addMembersToGroup(
                conversationId, principal.getName(), newMembers, nameObj);

        return ResponseEntity.ok(updatedConversation);
    }
    @PostMapping("/{conversationId}/remove_members")
    public ResponseEntity<Conversation> removeMemberFromGroup(
            @PathVariable String conversationId,
            @RequestBody MembersRequest request,
            Principal principal) {

        List<String> memberId = request.getMembers();
        List<String> nameObj = request.getFullName();
        Conversation updatedConversation = chatService.removeMemberFromGroup(
                conversationId, principal.getName(), memberId, nameObj);

        return ResponseEntity.ok(updatedConversation);
    }

    @PostMapping("/{conversationId}/join")
    public ResponseEntity<Conversation> joinGroup(
            @PathVariable String conversationId,
            Principal principal) {

        Conversation conversation = chatService.joinGroup(conversationId, principal.getName());

        return ResponseEntity.ok(conversation);
    }

    @DeleteMapping("/{conversationId}/delete")
    public ResponseEntity<Void> deleteGroup(
            @PathVariable String conversationId,
            Principal principal) {

        chatService.deleteGroupConversation(conversationId);
        return ResponseEntity.noContent().build();
    }
}
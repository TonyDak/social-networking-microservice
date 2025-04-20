package com.example.friendservice.controller;

import com.example.friendservice.model.Friend;
import com.example.friendservice.model.FriendRequest;
import com.example.friendservice.service.FriendService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/")
@Slf4j
public class FriendController {
    private final FriendService friendService;

    @Autowired
    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    @GetMapping
    public ResponseEntity<List<Friend>> getFriends(
            @RequestHeader("X-User-ID") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection) {
        log.info("Getting friends for user {} with page={}, size={}", userId, page, size);

        if (sortBy != null) {
            return ResponseEntity.ok(friendService.getFriends(userId, page, size, sortBy, sortDirection));
        } else {
            return ResponseEntity.ok(friendService.getFriends(userId, page, size));
        }
    }

    @PostMapping("/request")
    public ResponseEntity<FriendRequest> sendFriendRequest(
            @RequestHeader("X-User-ID") String userId,
            @Valid @RequestBody FriendRequest request) {
        log.info("Sending friend request from {} to {}", userId, request.getReceiverId());
        // Set sender id from auth header
        request.setSenderId(userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(friendService.sendFriendRequest(request));
    }

    @GetMapping("/requests/pending")
    public ResponseEntity<List<FriendRequest>> getPendingRequests(
            @RequestHeader("X-User-ID") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("Getting pending friend requests for user {}", userId);
        return ResponseEntity.ok(
                friendService.getPendingRequests(userId, page, size));
    }

    @PostMapping("/requests/{requestId}/accept")
    public ResponseEntity<Void> acceptFriendRequest(
            @RequestHeader("X-User-ID") String userId,
            @PathVariable Long requestId) {
        log.info("User {} accepting friend request {}", userId, requestId);
        friendService.acceptFriendRequest(requestId, userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<Void> rejectFriendRequest(
            @RequestHeader("X-User-ID") String userId,
            @PathVariable Long requestId) {
        log.info("User {} rejecting friend request {}", userId, requestId);
        friendService.rejectFriendRequest(requestId, userId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/remove/{friendId}")
    public ResponseEntity<Void> removeFriend(
            @RequestHeader("X-User-ID") String userId,
            @PathVariable String friendId) {
        log.info("Removing friend relationship between {} and {}", userId, friendId);
        friendService.removeFriend(userId, friendId);
        return ResponseEntity.ok().build();
    }

    //areFriends
    @GetMapping("/areFriends/{friendId}")
    public ResponseEntity<Boolean> areFriends(
            @RequestHeader("X-User-ID") String userId,
            @PathVariable String friendId) {
        log.info("Checking if {} and {} are friends", userId, friendId);
        boolean areFriends = friendService.areFriends(userId, friendId);
        return ResponseEntity.ok(areFriends);
    }
}
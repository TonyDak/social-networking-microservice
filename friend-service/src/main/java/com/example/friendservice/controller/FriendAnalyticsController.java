package com.example.friendservice.controller;

import com.example.friendservice.service.FriendAnalyticsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/analytics")
@Slf4j
public class FriendAnalyticsController {
    private final FriendAnalyticsService friendAnalyticsService;

    @Autowired
    public FriendAnalyticsController(FriendAnalyticsService friendAnalyticsService) {
        this.friendAnalyticsService = friendAnalyticsService;
    }

    @GetMapping("/mutual/{userId}")
    public ResponseEntity<List<String>> getMutualFriends(
            @RequestHeader("X-User-ID") String currentUserId,
            @PathVariable String userId) {
        log.info("Finding mutual friends between {} and {}", currentUserId, userId);
        return ResponseEntity.ok(friendAnalyticsService.getMutualFriends(currentUserId, userId));
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<String>> getFriendSuggestions(
            @RequestHeader("X-User-ID") String userId,
            @RequestParam(defaultValue = "10") int limit) {
        log.info("Getting friend suggestions for user {}, limit {}", userId, limit);
        return ResponseEntity.ok(friendAnalyticsService.getFriendSuggestions(userId, limit));
    }
}

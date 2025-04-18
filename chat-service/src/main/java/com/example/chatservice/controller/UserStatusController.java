package com.example.chatservice.controller;


import com.example.chatservice.repository.UserStatusRepository;
import com.example.chatservice.service.UserStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class UserStatusController {
    private final UserStatusService userStatusService;

    @PostMapping("/online/{userId}")
    public ResponseEntity<String> setUserOnline(@PathVariable String userId) {
        userStatusService.setUserOnline(userId);
        return ResponseEntity.ok("User " + userId + " is now ONLINE");
    }

    @PostMapping("/offline/{userId}")
    public ResponseEntity<String> setUserOffline(@PathVariable String userId) {
        userStatusService.setUserOffline(userId);
        return ResponseEntity.ok("User " + userId + " is now OFFLINE");
    }

    @GetMapping("/getAllUserStatuses")
    public Map<String, String> getAllUserStatuses() {
        return userStatusService.getAllUserStatuses();
    }

    @PostMapping("/user-status/{userId}")
    public ResponseEntity<String> getUserStatus(@PathVariable String userId) {
        String status = userStatusService.getUserStatus(userId);
        return ResponseEntity.ok(status);
    }

    @PostMapping("/ping/{userId}")
    public ResponseEntity<Void> updateUserActivity(@PathVariable String userId) {
        userStatusService.updateLastActive(userId);
        return ResponseEntity.ok().build();
    }
}

package com.example.friendservice.service;

import com.example.friendservice.repository.FriendRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Slf4j
public class FriendAnalyticsService {
    private final FriendRepository friendRepository;

    public FriendAnalyticsService(FriendRepository friendRepository) {
        this.friendRepository = friendRepository;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "mutualFriends", key = "#userId1 + '_' + #userId2")
    public List<String> getMutualFriends(String userId1, String userId2) {
        log.info("Finding mutual friends between {} and {}", userId1, userId2);
        return friendRepository.findMutualFriends(userId1, userId2);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "friendSuggestions", key = "#userId + '_limit_' + #limit")
    public List<String> getFriendSuggestions(String userId, int limit) {
        log.info("Getting friend suggestions for user {}", userId);
        return friendRepository.findFriendSuggestions(userId, limit);
    }
}
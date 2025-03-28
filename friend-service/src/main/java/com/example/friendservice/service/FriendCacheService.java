package com.example.friendservice.service;

import com.example.friendservice.model.Friend;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class FriendCacheService {
    private final RedisTemplate<String, Object> redisTemplate;
    private final long CACHE_TTL = 60 * 60; // 1 giờ

    public FriendCacheService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public List<Friend> getFriendList(String userId) {
        String key = "friends:" + userId;
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                return (List<Friend>) cached;
            }
        } catch (Exception e) {
            log.error("Error retrieving friend list from cache for user {}: {}", userId, e.getMessage());
        }
        return null;
    }

    public void cacheFriendList(String userId, List<Friend> friends) {
        String key = "friends:" + userId;
        try {
            redisTemplate.opsForValue().set(key, friends);
            redisTemplate.expire(key, CACHE_TTL, TimeUnit.SECONDS);
            log.debug("Cached friend list for user {}", userId);
        } catch (Exception e) {
            log.error("Error caching friend list for user {}: {}", userId, e.getMessage());
        }
    }

    public void invalidateCache(String userId) {
        String key = "friends:" + userId;
        try {
            redisTemplate.delete(key);
            log.debug("Invalidated friend cache for user {}", userId);
        } catch (Exception e) {
            log.error("Error invalidating cache for user {}: {}", userId, e.getMessage());
        }
    }

    // Cache mutual friends
    public void cacheMutualFriends(String userId1, String userId2, List<String> mutualFriends) {
        String key = "mutual_friends:" + userId1 + ":" + userId2;
        try {
            redisTemplate.opsForValue().set(key, mutualFriends);
            redisTemplate.expire(key, CACHE_TTL, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("Error caching mutual friends: {}", e.getMessage());
        }
    }
}
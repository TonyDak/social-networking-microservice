package com.example.notificationservice.service;

import com.example.notificationservice.dto.ChatMessageDto;
import com.example.notificationservice.dto.ConversationDto;
import com.example.notificationservice.model.Notification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String NOTIFICATION_KEY = "notifications:";
    private static final String UNREAD_COUNT_KEY = "unread_count:";
    private static final int NOTIFICATION_TTL = 7; // số ngày lưu thông báo

    public void createMessageNotification(ChatMessageDto message) {
        Notification notification = new Notification();
        notification.setId(UUID.randomUUID().toString());
        notification.setUserId(message.getReceiverId());
        notification.setSenderId(message.getSenderId());
        notification.setMessageId(message.getId());
        notification.setConversationId(message.getConversationId());
        notification.setContent(message.getContent());
        notification.setType("MESSAGE");
        notification.setCreatedAt(LocalDateTime.now());
        notification.setRead(false);

        // Lưu vào Redis với thời gian hết hạn
        String key = NOTIFICATION_KEY + message.getReceiverId() + ":" + notification.getId();
        redisTemplate.opsForValue().set(key, notification);
        redisTemplate.expire(key, NOTIFICATION_TTL, TimeUnit.DAYS);

        // Tăng số lượng thông báo chưa đọc
        redisTemplate.opsForValue().increment(UNREAD_COUNT_KEY + message.getReceiverId());

        log.info("Created notification for user: {}", message.getReceiverId());
    }

    public void createGroupMessageNotifications(ChatMessageDto message, List<String> participants) {
        participants.stream()
                .filter(userId -> !userId.equals(message.getSenderId()))
                .forEach(userId -> {
                    Notification notification = new Notification();
                    notification.setId(UUID.randomUUID().toString());
                    notification.setUserId(userId);
                    notification.setSenderId(message.getSenderId());
                    notification.setMessageId(message.getId());
                    notification.setConversationId(message.getConversationId());
                    notification.setContent(message.getContent());
                    notification.setType("GROUP_MESSAGE");
                    notification.setCreatedAt(LocalDateTime.now());
                    notification.setRead(false);

                    String key = NOTIFICATION_KEY + userId + ":" + notification.getId();
                    redisTemplate.opsForValue().set(key, notification);
                    redisTemplate.expire(key, NOTIFICATION_TTL, TimeUnit.DAYS);

                    redisTemplate.opsForValue().increment(UNREAD_COUNT_KEY + userId);

                    log.info("Created group notification for user: {}", userId);
                });
    }

    public List<Notification> getUserNotifications(String userId) {
        String pattern = NOTIFICATION_KEY + userId + ":*";
        return redisTemplate.keys(pattern).stream()
                .map(key -> (Notification) redisTemplate.opsForValue().get(key))
                .sorted((n1, n2) -> n2.getCreatedAt().compareTo(n1.getCreatedAt()))
                .collect(Collectors.toList());
    }

    public long getUnreadCount(String userId) {
        Object count = redisTemplate.opsForValue().get(UNREAD_COUNT_KEY + userId);
        return count != null ? Long.parseLong(count.toString()) : 0;
    }

    public void markAsRead(String userId, String notificationId) {
        String key = NOTIFICATION_KEY + userId + ":" + notificationId;
        Notification notification = (Notification) redisTemplate.opsForValue().get(key);

        if (notification != null && !notification.isRead()) {
            notification.setRead(true);
            redisTemplate.opsForValue().set(key, notification);
            redisTemplate.opsForValue().decrement(UNREAD_COUNT_KEY + userId);
        }
    }

    public void markAllAsRead(String userId) {
        String pattern = NOTIFICATION_KEY + userId + ":*";
        redisTemplate.keys(pattern).forEach(key -> {
            Notification notification = (Notification) redisTemplate.opsForValue().get(key);
            if (notification != null && !notification.isRead()) {
                notification.setRead(true);
                redisTemplate.opsForValue().set(key, notification);
            }
        });
        redisTemplate.delete(UNREAD_COUNT_KEY + userId);
    }
}
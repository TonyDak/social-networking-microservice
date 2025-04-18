package com.example.chatservice.service;

import com.example.chatservice.model.UserStatus;
import com.example.chatservice.repository.UserStatusRepository;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class UserStatusService {
    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(UserStatusService.class);
    private final UserStatusRepository userStatusRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final Map<String, UserStatus> userStatusMap = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private static final long TIMEOUT_MINUTES = 2;


    @Value("${user.status.expiry}")
    private long userStatusExpiry;

    public UserStatusService(UserStatusRepository userStatusRepository, SimpMessagingTemplate messagingTemplate) {
        this.userStatusRepository = userStatusRepository;
        this.messagingTemplate = messagingTemplate;
        scheduler.scheduleAtFixedRate(this::checkTimeouts, 0, 1, TimeUnit.MINUTES);
    }

    public void setUserOnline(String userId) {
        UserStatus status = new UserStatus(userId, "ONLINE", userStatusExpiry);
        userStatusRepository.save(status);
        userStatusMap.put(userId, status);
        logger.info("User {} is online", userId);
        broadcastUserStatus(userId, "ONLINE");
    }

    public void setUserOffline(String userId) {
        UserStatus status = new UserStatus(userId, "OFFLINE", null);
        userStatusRepository.save(status);
        userStatusMap.remove(userId);
        logger.info("User {} is offline", userId);
        broadcastUserStatus(userId, "OFFLINE");
    }

    private void broadcastUserStatus(String userId, String status) {
        Map<String, Object> event = new HashMap<>();
        event.put("userId", userId);
        event.put("status", status);
        messagingTemplate.convertAndSend("/topic/user-status", event);
    }

    public String getUserStatus(String userId) {
        UserStatus status = userStatusRepository.findById(userId).orElse(null);
        return status != null ? status.getStatus() : "OFFLINE";
    }
    public Map<String, String> getAllUserStatuses() {
        Map<String, String> statuses = new HashMap<>();
        userStatusRepository.findAll().forEach(userStatus -> {
            statuses.put(userStatus.getUserId(), userStatus.getStatus());
        });
        return statuses;
    }

    // Phương thức mới: cập nhật thời gian hoạt động cuối cùng (gọi khi nhận ping)
    public void updateLastActive(String userId) {
        // Cập nhật trong cache
        UserStatus cachedStatus = userStatusMap.computeIfAbsent(userId, id -> {
            // Kiểm tra trong Redis nếu không có trong cache
            return userStatusRepository.findById(id).orElse(new UserStatus(id, "ONLINE", userStatusExpiry));
        });

        cachedStatus.setLastActiveTime(new Date());

        // Cập nhật cả Redis
        userStatusRepository.save(cachedStatus);
    }

    // Phương thức mới: kiểm tra các timeout
    private void checkTimeouts() {
        Date now = new Date();
        userStatusMap.forEach((userId, status) -> {
            if (status.isOnline()) {
                Date lastActive = status.getLastActiveTime();
                if (lastActive != null) {
                    long diffMinutes = TimeUnit.MILLISECONDS.toMinutes(now.getTime() - lastActive.getTime());
                    if (diffMinutes >= TIMEOUT_MINUTES) {
                        // Gọi setUserOffline để cập nhật Redis và broadcast
                        setUserOffline(userId);
                        logger.info("User {} marked offline due to timeout", userId);
                    }
                }
            }
        });
    }

    @PreDestroy
    public void cleanup() {
        scheduler.shutdown();
    }
}
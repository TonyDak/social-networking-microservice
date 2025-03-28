package com.example.notificationservice.kafka;

import com.example.notificationservice.dto.ChatMessageDto;
import com.example.notificationservice.dto.ConversationDto;
import com.example.notificationservice.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationConsumer {

    private final NotificationService notificationService;

    @KafkaListener(topics = "private-messages", groupId = "notification-group")
    public void consumePrivateMessage(ChatMessageDto message) {
        log.info("Received private message: {}", message);
        notificationService.createMessageNotification(message);
    }

    @KafkaListener(topics = "group-messages", groupId = "notification-group")
    public void consumeGroupMessage(ChatMessageDto message) {
        log.info("Received group message: {}", message);
        // Trong trường hợp tin nhắn nhóm, chúng ta cần lấy thông tin participants từ service khác
        // Ở đây có 2 phương án:
        // 1. Gọi API từ conversation-service để lấy participants
        // 2. Hoặc có thể được gửi kèm trong message payload

        // Giả sử thông tin participants đã được gửi kèm trong message
        ConversationDto conversation = getConversationDetails(message.getConversationId());
        notificationService.createGroupMessageNotifications(message, conversation.getParticipants());
    }

    // Phương thức này có thể gọi REST API đến conversation-service
    private ConversationDto getConversationDetails(String conversationId) {
        // Implement API call to conversation service
        // Có thể sử dụng RestTemplate hoặc WebClient
        log.info("Fetching conversation details for ID: {}", conversationId);
        return new ConversationDto(); // placeholder
    }
}
package com.example.chatservice.kafka;

import com.example.chatservice.model.ChatMessage;
import com.example.chatservice.model.Conversation;
import com.example.chatservice.repository.ConversationRepository;
import com.example.chatservice.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class MessageConsumer {

    private final SimpMessagingTemplate messagingTemplate;
    private final ConversationRepository conversationRepository;

    @KafkaListener(topics = "private-messages", containerFactory = "kafkaListenerContainerFactory")
    public void consumePrivateMessage(ChatMessage message) {
        log.info("Received private message: {}", message);

        // Gửi tin nhắn đến người nhận qua WebSocket
        messagingTemplate.convertAndSendToUser(
                message.getReceiverId(),
                "/queue/messages",
                message
        );
    }

    @KafkaListener(topics = "group-messages", containerFactory = "kafkaListenerContainerFactory")
    public void consumeGroupMessage(ChatMessage message) {
        log.info("Received group message: {}", message);

        // Tìm cuộc trò chuyện nhóm
        Conversation conversation = conversationRepository.findById(message.getConversationId())
                .orElse(null);

        if (conversation != null) {
            // Gửi tin nhắn đến tất cả thành viên trong nhóm qua WebSocket
            messagingTemplate.convertAndSend(
                    "/topic/group/" + message.getConversationId(),
                    message
            );
        }
    }
}
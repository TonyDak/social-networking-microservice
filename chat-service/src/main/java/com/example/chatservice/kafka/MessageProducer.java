package com.example.chatservice.kafka;

import com.example.chatservice.model.ChatMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MessageProducer {

    private final KafkaTemplate<String, ChatMessage> kafkaTemplate;

    public void sendPrivateMessage(ChatMessage message) {
        kafkaTemplate.send("private-messages", message.getReceiverId(), message);
    }

    public void sendGroupMessage(ChatMessage message) {
        kafkaTemplate.send("group-messages", message.getConversationId(), message);
    }
}
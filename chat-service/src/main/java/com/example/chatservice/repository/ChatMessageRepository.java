package com.example.chatservice.repository;

import com.example.chatservice.model.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    List<ChatMessage> findByConversationIdOrderByTimestampAsc(String conversationId);
    List<ChatMessage> findByReceiverIdAndStatus(String receiverId, String status);
    List<ChatMessage> findByConversationIdAndSenderIdAndReceiverIdAndStatus(String conversationId, String senderId, String receiverId, String status);
    List<ChatMessage> findByConversationIdInOrderByTimestampDesc(List<String> conversationIds, Pageable pageable);
}

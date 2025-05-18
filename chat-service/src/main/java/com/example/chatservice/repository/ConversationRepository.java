package com.example.chatservice.repository;

import com.example.chatservice.model.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends MongoRepository<Conversation, String> {
    List<Conversation> findByParticipantsContaining(String userId);

    List<Conversation> findByParticipantsContainingAndType(String userId, String type);

    // Thay thế phương thức hiện tại với một truy vấn tùy chỉnh
    @Query("{ 'type': ?0, 'participants': { $all: [?1, ?2] } }")
    Optional<Conversation> findByTypeAndBothParticipants(String type, String participant1, String participant2);


}
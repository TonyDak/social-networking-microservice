package com.example.chatservice.service;

import com.example.chatservice.kafka.MessageProducer;
import com.example.chatservice.model.ChatMessage;
import com.example.chatservice.model.Conversation;
import com.example.chatservice.repository.ChatMessageRepository;
import com.example.chatservice.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final ConversationRepository conversationRepository;
    private final MessageProducer messageProducer;

    /**
     * Xử lý gửi tin nhắn từ REST API
     */
    @Transactional
    public ChatMessage sendMessage(ChatMessage chatMessageDTO) {
        if (chatMessageDTO.getConversationId() != null) {
            return saveGroupMessage(chatMessageDTO);
        } else {
            return savePrivateMessage(chatMessageDTO);
        }
    }

    /**
     * Lấy tin nhắn giữa hai người dùng
     */
    public List<ChatMessage> getConversationMessages(String userId1, String userId2) {
        String conversationId = generateConversationId(userId1, userId2);
        return chatMessageRepository.findByConversationIdOrderByTimestampAsc(conversationId);
    }

    /**
     * Lấy tin nhắn theo ID cuộc hội thoại
     */
    @Cacheable(value = "conversationMessages", key = "#conversationId + '-' + #page + '-' + #size")
    public List<ChatMessage> getMessagesByConversationId(String conversationId, int page, int size) {
        List<ChatMessage> messages = chatMessageRepository.findByConversationIdOrderByTimestampDesc(
                conversationId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"))
        );
        // Đảo ngược để hiển thị từ cũ đến mới
        Collections.reverse(messages);
        return messages;
    }

    /**
     * Lấy tin nhắn gần đây của người dùng
     */
    @Cacheable(value = "recentMessages", key = "#userId + '-' + #limit")
    public List<ChatMessage> getRecentMessages(String userId, int limit) {
        List<Conversation> conversations = conversationRepository.findByParticipantsContaining(userId);
        List<String> conversationIds = conversations.stream()
                .map(Conversation::getId)
                .collect(Collectors.toList());

        // Lấy tin nhắn gần đây của tất cả cuộc trò chuyện
        return chatMessageRepository.findByConversationIdInOrderByTimestampDesc(
                conversationIds,
                PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "timestamp"))
        );
    }

    /**
     * Lấy tin nhắn chưa đọc của người dùng
     */
    public List<ChatMessage> getUnreadMessages(String userId) {
        return chatMessageRepository.findByReceiverIdAndStatus(userId, "UNREAD");
    }

    /**
     * Lưu tin nhắn cá nhân và gửi qua Kafka
     */
    @CacheEvict(value = { "conversationMessages", "userConversations" }, allEntries = true)
    @Transactional
    public ChatMessage savePrivateMessage(ChatMessage chatMessage) {
        String type = "ONE_TO_ONE";
        String senderId = chatMessage.getSenderId();
        String receiverId = chatMessage.getReceiverId();

        Conversation conversation = conversationRepository
                .findByTypeAndBothParticipants(type, senderId, receiverId)
                .orElseGet(() -> {
                    Conversation newConversation = new Conversation();
                    newConversation.setType(type);
                    newConversation.setParticipants(Arrays.asList(senderId, receiverId));
                    newConversation.setCreatorId(senderId);
                    newConversation.onCreate();
                    return conversationRepository.save(newConversation);
                });

        chatMessage.setConversationId(conversation.getId());
        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessage.setStatus("UNREAD");
        ChatMessage savedMessage = chatMessageRepository.save(chatMessage);

        conversation.setLastActivity(LocalDateTime.now());
        conversation.setLastMessageId(savedMessage.getId());
        conversation.setLastMessageContent(savedMessage.getContent());
        conversation.setLastMessageSenderId(savedMessage.getSenderId());
        conversationRepository.save(conversation);

        messageProducer.sendPrivateMessage(savedMessage);

        return savedMessage;
    }

    /**
     * Lưu tin nhắn nhóm và gửi qua Kafka
     */
    @CacheEvict(value = { "conversationMessages", "userConversations" }, allEntries = true)
    @Transactional
    public ChatMessage saveGroupMessage(ChatMessage chatMessage) {
        String conversationId = chatMessage.getConversationId();
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm chat"));

        if (!conversation.getParticipants().contains(chatMessage.getSenderId())) {
            throw new RuntimeException("Người dùng không thuộc nhóm chat này");
        }

        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessage.setStatus("UNREAD");
        ChatMessage savedMessage = chatMessageRepository.save(chatMessage);

        conversation.setLastActivity(LocalDateTime.now());
        conversation.setLastMessageId(savedMessage.getId());
        conversation.setLastMessageContent(savedMessage.getContent());
        conversation.setLastMessageSenderId(savedMessage.getSenderId());
        conversationRepository.save(conversation);

        messageProducer.sendGroupMessage(savedMessage);

        return savedMessage;
    }

    /**
     * Đánh dấu một tin nhắn đã đọc
     */
    public ChatMessage markAsRead(String messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn"));
        message.setStatus("READ");
        return chatMessageRepository.save(message);
    }

    /**
     * Đánh dấu tất cả tin nhắn giữa 2 người đã đọc
     */
    public void markAllMessagesAsRead(String senderId, String receiverId) {
        String conversationId = generateConversationId(senderId, receiverId);
        List<ChatMessage> unreadMessages = chatMessageRepository.findByConversationIdAndSenderIdAndReceiverIdAndStatus(
                conversationId, senderId, receiverId, "UNREAD");

        unreadMessages.forEach(message -> message.setStatus("READ"));
        chatMessageRepository.saveAll(unreadMessages);
    }

    /**
     * Tạo conversationId từ 2 userId
     */
    public String generateConversationId(String userId1, String userId2) {
        return userId1.compareTo(userId2) < 0
                ? userId1 + "_" + userId2
                : userId2 + "_" + userId1;
    }

    /**
     * Quản lý nhóm chat
     */
    @Transactional
    @CacheEvict(value = { "conversationMessages", "userConversations" }, allEntries = true)
    public Conversation createGroupConversation(String name, String creatorId, List<String> participantIds) {
        if (!participantIds.contains(creatorId)) {
            participantIds.add(creatorId);
        }

        Conversation conversation = new Conversation();
        conversation.setName(name);
        conversation.setType("GROUP");
        conversation.setCreatorId(creatorId);
        conversation.setParticipants(participantIds);
        conversation.onCreate();

        return conversationRepository.save(conversation);
    }

    /**
     * Lấy danh sách cuộc hội thoại của người dùng
     */
    @Cacheable(value = "userConversations", key = "#userId")
    public List<Conversation> getUserConversations(String userId) {
        return conversationRepository.findByParticipantsContaining(userId);
    }

    /**
     * getGroupConversations
     */
    @Cacheable(value = "groupConversations", key = "#userId")
    public List<Conversation> getGroupConversations(String userId) {
        return conversationRepository.findByParticipantsContainingAndType(userId, "GROUP");
    }

    /**
     * Thêm thành viên vào nhóm chat
     */
    @Transactional
    @CacheEvict(value = { "conversationMessages", "userConversations" }, allEntries = true)
    public Conversation addMembersToGroup(String conversationId, String requesterId, List<String> newMembers, List<String> fullName) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm chat"));

        // Kiểm tra quyền và loại cuộc hội thoại
        if (!"GROUP".equals(conversation.getType())) {
            throw new RuntimeException("Không phải là nhóm chat");
        }

        if (!conversation.getParticipants().contains(requesterId)) {
            throw new RuntimeException("Bạn không phải là thành viên của nhóm chat này");
        }

        // Thêm các thành viên mới (bỏ qua những người đã là thành viên)
        List<String> participants = conversation.getParticipants();
        for (String memberId : newMembers) {
            if (!participants.contains(memberId)) {
                participants.add(memberId);
            }
        }

        conversation.setParticipants(participants);
        conversation.setLastActivity(LocalDateTime.now());

        // Lưu và thông báo
        Conversation updatedConversation = conversationRepository.save(conversation);

        // Tạo thông báo hệ thống trong nhóm chat
        ChatMessage systemMessage = new ChatMessage();
        systemMessage.setConversationId(conversationId);
        systemMessage.setSenderId("SYSTEM");
        systemMessage.setContent("Thành viên mới đã tham gia nhóm: " + String.join(", ", fullName));
        systemMessage.setTimestamp(LocalDateTime.now());
        systemMessage.setType("SYSTEM");
        chatMessageRepository.save(systemMessage);

        return updatedConversation;
    }

    /**
     * Xóa thành viên khỏi nhóm chat
     */
    @Transactional
    @CacheEvict(value = { "conversationMessages", "userConversations" }, allEntries = true)
    public Conversation removeMemberFromGroup(String conversationId, String requesterId, List<String> memberIds, List<String> fullNames) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm chat"));

        if (!"GROUP".equals(conversation.getType())) {
            throw new RuntimeException("Không phải là nhóm chat");
        }

        List<String> participants = conversation.getParticipants();

        for (int i = 0; i < memberIds.size(); i++) {
            String memberId = memberIds.get(i);

            // Only group creator or the member themselves can remove
            if (!requesterId.equals(conversation.getCreatorId()) && !requesterId.equals(memberId)) {
                throw new RuntimeException("Bạn không có quyền xóa thành viên khỏi nhóm: " + memberId);
            }

            // Cannot remove group creator
            if (memberId.equals(conversation.getCreatorId())) {
                throw new RuntimeException("Không thể xóa người tạo nhóm");
            }

            if (participants.contains(memberId)) {
                participants.remove(memberId);
            } else {
                throw new RuntimeException("Người dùng không phải là thành viên của nhóm: " + memberId);
            }
        }

        conversation.setParticipants(participants);
        conversation.setLastActivity(LocalDateTime.now());
        Conversation updatedConversation = conversationRepository.save(conversation);

        // System message with all removed members' names
        ChatMessage systemMessage = new ChatMessage();
        systemMessage.setConversationId(conversationId);
        systemMessage.setSenderId("SYSTEM");
        systemMessage.setContent("Thành viên đã rời khỏi nhóm: " + String.join(", ", fullNames));
        systemMessage.setTimestamp(LocalDateTime.now());
        systemMessage.setType("SYSTEM");
        chatMessageRepository.save(systemMessage);

        return updatedConversation;
    }

    /**
     * Tham gia vào nhóm chat
     */
    @Transactional
    public Conversation joinGroup(String conversationId, String userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm chat"));

        // Kiểm tra loại cuộc hội thoại
        if (!"GROUP".equals(conversation.getType())) {
            throw new RuntimeException("Không phải là nhóm chat");
        }

        // Kiểm tra xem người dùng đã là thành viên chưa
        List<String> participants = conversation.getParticipants();
        if (participants.contains(userId)) {
            throw new RuntimeException("Bạn đã là thành viên của nhóm chat");
        }

        // Kiểm tra xem nhóm có cho phép tham gia tự do không (có thể thêm logic kiểm tra ở đây)
        // Ví dụ: if (!conversation.isPublic()) { throw new RuntimeException("Nhóm chat này không cho phép tham gia tự do"); }

        // Thêm người dùng vào nhóm
        participants.add(userId);
        conversation.setParticipants(participants);
        conversation.setLastActivity(LocalDateTime.now());

        // Lưu và thông báo
        Conversation updatedConversation = conversationRepository.save(conversation);

        // Tạo thông báo hệ thống trong nhóm chat
        ChatMessage systemMessage = new ChatMessage();
        systemMessage.setConversationId(conversationId);
        systemMessage.setSenderId("SYSTEM");
        systemMessage.setContent("Thành viên mới đã tham gia nhóm");
        systemMessage.setTimestamp(LocalDateTime.now());
        systemMessage.setType("SYSTEM");
        chatMessageRepository.save(systemMessage);

        return updatedConversation;
    }

    /**
     * Xóa nhóm chat đồng thời xóa tất cả tin nhắn liên quan
     */
    @Transactional
    @CacheEvict(value = { "conversationMessages", "userConversations" }, allEntries = true)
    public void deleteGroupConversation(String conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm chat"));

        // Xóa tất cả tin nhắn liên quan
        chatMessageRepository.deleteByConversationId(conversationId);

        // Xóa nhóm chat
        conversationRepository.delete(conversation);
    }
}
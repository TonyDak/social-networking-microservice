package com.example.chatservice.service;

import com.example.chatservice.kafka.MessageProducer;
import com.example.chatservice.model.ChatMessage;
import com.example.chatservice.model.Conversation;
import com.example.chatservice.repository.ChatMessageRepository;
import com.example.chatservice.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
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
    public List<ChatMessage> getMessagesByConversationId(String conversationId) {
        return chatMessageRepository.findByConversationIdOrderByTimestampAsc(conversationId);
    }

    /**
     * Lấy tin nhắn gần đây của người dùng
     */
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

    public List<Conversation> getUserConversations(String userId) {
        return conversationRepository.findByParticipantsContaining(userId);
    }

    /**
     * Thêm thành viên vào nhóm chat
     */
    @Transactional
    public Conversation addMembersToGroup(String conversationId, String requesterId, List<String> newMembers) {
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
        systemMessage.setContent("Đã thêm " + newMembers.size() + " thành viên mới vào nhóm");
        systemMessage.setTimestamp(LocalDateTime.now());
        systemMessage.setType("SYSTEM");
        chatMessageRepository.save(systemMessage);

        return updatedConversation;
    }

    /**
     * Xóa thành viên khỏi nhóm chat
     */
    @Transactional
    public Conversation removeMemberFromGroup(String conversationId, String requesterId, String memberId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm chat"));

        // Kiểm tra quyền và loại cuộc hội thoại
        if (!"GROUP".equals(conversation.getType())) {
            throw new RuntimeException("Không phải là nhóm chat");
        }

        // Chỉ người tạo nhóm hoặc thành viên được phép xóa chính họ
        if (!requesterId.equals(conversation.getCreatorId()) && !requesterId.equals(memberId)) {
            throw new RuntimeException("Bạn không có quyền xóa thành viên khỏi nhóm");
        }

        // Không cho phép xóa người tạo nhóm
        if (memberId.equals(conversation.getCreatorId())) {
            throw new RuntimeException("Không thể xóa người tạo nhóm");
        }

        // Xóa thành viên
        List<String> participants = conversation.getParticipants();
        if (participants.contains(memberId)) {
            participants.remove(memberId);
            conversation.setParticipants(participants);
            conversation.setLastActivity(LocalDateTime.now());
        } else {
            throw new RuntimeException("Người dùng không phải là thành viên của nhóm");
        }

        // Lưu và thông báo
        Conversation updatedConversation = conversationRepository.save(conversation);

        // Tạo thông báo hệ thống trong nhóm chat
        ChatMessage systemMessage = new ChatMessage();
        systemMessage.setConversationId(conversationId);
        systemMessage.setSenderId("SYSTEM");
        systemMessage.setContent("Thành viên đã rời nhóm");
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
}
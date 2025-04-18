package com.example.chatservice.controller;

import com.example.chatservice.model.ChatMessage;
import com.example.chatservice.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class WebSocketChatController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    // Xử lý tin nhắn 1-1
    @MessageMapping("/chat.private.{receiverId}")
    public void sendPrivateMessage(@Payload ChatMessage chatMessage,
                                   @DestinationVariable String receiverId,
                                   Principal principal) {
        chatMessage.setSenderId(principal.getName());
        chatMessage.setReceiverId(receiverId);

        // ChatService sẽ lưu và phân phối tin nhắn qua Kafka
        chatService.savePrivateMessage(chatMessage);
        messagingTemplate.convertAndSendToUser(receiverId, "/queue/messages", chatMessage);
    }

    // Xử lý tin nhắn nhóm
    @MessageMapping("/chat.group.{conversationId}")
    public void sendGroupMessage(@Payload ChatMessage chatMessage,
                                 @DestinationVariable String conversationId,
                                 Principal principal) {
        chatMessage.setSenderId(principal.getName());
        chatMessage.setConversationId(conversationId);

        // ChatService sẽ lưu và phân phối tin nhắn qua Kafka
        chatService.saveGroupMessage(chatMessage);
        messagingTemplate.convertAndSend("/topic/group/" + conversationId, chatMessage);
    }
    /**
     * Xử lý ping từ client để giữ kết nối
     */
    @MessageMapping("/ping")
    @SendTo("/topic/pong")
    public void handlePing() {
        // Không cần thực hiện thêm hành động nào
        // Đơn giản chỉ nhận message và không làm gì
        System.out.println("Received heartbeat ping from client");
    }
}
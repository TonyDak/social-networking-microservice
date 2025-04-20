package com.example.chatservice.service;

import com.example.chatservice.model.CallSession;
import com.example.chatservice.model.WebRTCSignal;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class CallService {
    private static final Logger logger = LoggerFactory.getLogger(CallService.class);
    private final SimpMessagingTemplate messagingTemplate;
    private final UserStatusService userStatusService;

    private final Map<String, CallSession> activeCalls = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

    // Timeout for ringing calls (30 seconds)
    private static final long CALL_RINGING_TIMEOUT = 30;

    public CallSession initiateCall(String callerId, String receiverId, CallSession.CallType callType) {
        // Check if receiver is online
        String receiverStatus = userStatusService.getUserStatus(receiverId);
        if (!"ONLINE".equals(receiverStatus)) {
            throw new IllegalStateException("Receiver is not online");
        }

        // Create a new call session
        String callId = UUID.randomUUID().toString();
        CallSession callSession = new CallSession(
                callId, callerId, receiverId, callType,
                CallSession.CallStatus.RINGING, new Date(), null
        );

        activeCalls.put(callId, callSession);

        // Send call request to receiver
        messagingTemplate.convertAndSendToUser(
                receiverId,
                "/queue/calls",
                Map.of(
                        "type", "incoming-call",
                        "callId", callId,
                        "callerId", callerId,
                        "callType", callType
                )
        );

        // Schedule timeout for ringing call
        scheduler.schedule(() -> {
            CallSession session = activeCalls.get(callId);
            if (session != null && session.getStatus() == CallSession.CallStatus.RINGING) {
                endCall(callId, CallSession.CallStatus.MISSED);
            }
        }, CALL_RINGING_TIMEOUT, TimeUnit.SECONDS);

        return callSession;
    }

    public void acceptCall(String callId, String userId) {
        CallSession callSession = activeCalls.get(callId);
        if (callSession == null) {
            throw new IllegalArgumentException("Call not found");
        }

        if (!callSession.getReceiverId().equals(userId)) {
            throw new IllegalArgumentException("User is not the call receiver");
        }

        callSession.setStatus(CallSession.CallStatus.ONGOING);

        // Notify the caller that call was accepted
        messagingTemplate.convertAndSendToUser(
                callSession.getCallerId(),
                "/queue/calls",
                Map.of(
                        "type", "call-accepted",
                        "callId", callId
                )
        );
    }

    public void rejectCall(String callId, String userId) {
        endCall(callId, CallSession.CallStatus.REJECTED);
    }

    public void endCall(String callId, CallSession.CallStatus endStatus) {
        CallSession callSession = activeCalls.get(callId);
        if (callSession == null) {
            return;
        }

        callSession.setStatus(endStatus);
        callSession.setEndTime(new Date());

        // Notify both parties
        messagingTemplate.convertAndSendToUser(
                callSession.getCallerId(),
                "/queue/calls",
                Map.of(
                        "type", "call-ended",
                        "callId", callId,
                        "status", endStatus
                )
        );

        messagingTemplate.convertAndSendToUser(
                callSession.getReceiverId(),
                "/queue/calls",
                Map.of(
                        "type", "call-ended",
                        "callId", callId,
                        "status", endStatus
                )
        );

        // Remove from active calls
        activeCalls.remove(callId);
    }

    public void handleSignal(WebRTCSignal signal) {
        // Forward the signal to the recipient
        messagingTemplate.convertAndSendToUser(
                signal.getTo(),
                "/queue/signals",
                signal
        );
    }
}
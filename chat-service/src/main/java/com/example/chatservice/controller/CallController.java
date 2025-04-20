package com.example.chatservice.controller;

import com.example.chatservice.model.CallSession;
import com.example.chatservice.model.WebRTCSignal;
import com.example.chatservice.service.CallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class CallController {
    private final CallService callService;

    @PostMapping("/calls/initiate")
    public ResponseEntity<?> initiateCall(
            Principal principal,
            @RequestBody Map<String, String> request) {

        String callerId = principal.getName();
        String receiverId = request.get("receiverId");
        String callTypeStr = request.get("callType");

        CallSession.CallType callType = "VIDEO".equals(callTypeStr) ?
                CallSession.CallType.VIDEO : CallSession.CallType.AUDIO;

        CallSession session = callService.initiateCall(callerId, receiverId, callType);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/calls/{callId}/accept")
    public ResponseEntity<?> acceptCall(
            Principal principal,
            @PathVariable String callId) {

        callService.acceptCall(callId, principal.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/calls/{callId}/reject")
    public ResponseEntity<?> rejectCall(
            Principal principal,
            @PathVariable String callId) {

        callService.rejectCall(callId, principal.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/calls/{callId}/end")
    public ResponseEntity<?> endCall(
            Principal principal,
            @PathVariable String callId) {

        callService.endCall(callId, CallSession.CallStatus.ENDED);
        return ResponseEntity.ok().build();
    }

    @MessageMapping("/calls/signal")
    public void handleSignal(@Payload WebRTCSignal signal, SimpMessageHeaderAccessor headerAccessor) {
        String userId = headerAccessor.getUser().getName();

        // Security check - ensure the sender is who they claim to be
        if (!userId.equals(signal.getFrom())) {
            return;
        }

        callService.handleSignal(signal);
    }
}
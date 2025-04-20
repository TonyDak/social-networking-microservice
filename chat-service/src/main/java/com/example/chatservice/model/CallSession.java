package com.example.chatservice.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CallSession {
    private String callId;
    private String callerId;
    private String receiverId;
    private CallType callType;
    private CallStatus status;
    private Date startTime;
    private Date endTime;

    public enum CallType {
        AUDIO, VIDEO
    }

    public enum CallStatus {
        RINGING, ONGOING, ENDED, REJECTED, MISSED
    }
}
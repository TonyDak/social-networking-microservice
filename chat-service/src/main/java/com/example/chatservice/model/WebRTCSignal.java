package com.example.chatservice.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WebRTCSignal {
    private String type; // "offer", "answer", "ice-candidate"
    private String callId;
    private String from;
    private String to;
    private Object payload; // SDP or ICE candidate
}
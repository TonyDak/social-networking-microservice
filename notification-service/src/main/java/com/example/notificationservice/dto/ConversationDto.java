package com.example.notificationservice.dto;

import lombok.Data;

import java.util.List;

@Data
public class ConversationDto {
    private String id;
    private String name;
    private List<String> participants;
    private String type;
}

package com.example.chatservice.dto;

import lombok.Data;

import java.util.List;

@Data
public class MembersRequest {
    private List<String> members;
    private List<String> fullName;
}

package com.example.friendservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendDTO {
    private String userId;
    private String friendId;
    private String nickname;
    private Boolean favorite;
    private LocalDateTime createdAt;

}

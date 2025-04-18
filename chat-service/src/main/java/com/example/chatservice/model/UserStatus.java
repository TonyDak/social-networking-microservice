package com.example.chatservice.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@RedisHash("userStatus")
public class UserStatus {
    @Id
    private String userId;
    private String status;
    private boolean online;
    private Date lastActiveTime;

    @TimeToLive
    private Long timeToLive;// Thời gian tính bằng giây

    public UserStatus(String userId, String status, Long timeToLive) {
        this.userId = userId;
        this.status = status;
        this.timeToLive = timeToLive;
        this.online = "ONLINE".equals(status);
        this.lastActiveTime = new Date();
    }
}
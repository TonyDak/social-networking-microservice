package com.example.userservice.service;

import com.example.userservice.dto.LoginEventDTO;
import com.example.userservice.dto.UserEventDTO;
import com.example.userservice.dto.UserInfoDTO;
import com.example.userservice.dto.UserUpdateDTO;
import com.example.userservice.entity.User;
import com.example.userservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.Date;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;

    @KafkaListener(topics = "${kafka.topic.user-creation}", groupId = "user-service", containerFactory = "userEventkafkaListenerContainerFactory")
    public void consumeUserCreationEvent(UserEventDTO userEvent) {
        try {
            log.info("Nhận message tạo user: {}", userEvent);

            // Kiểm tra user đã tồn tại chưa
            if (userRepository.existsByEmail(userEvent.getEmail())) {
                log.warn("User với email {} đã tồn tại", userEvent.getEmail());
                return;
            }

            if (userRepository.existsByUsername(userEvent.getUsername())) {
                log.warn("User với username {} đã tồn tại", userEvent.getUsername());
                return;
            }

            // Tạo và lưu user mới
            User newUser = User.builder()
                    .keycloakId(userEvent.getKeycloakId())
                    .username(userEvent.getUsername())
                    .email(userEvent.getEmail())
                    .firstName(userEvent.getFirstName())
                    .lastName(userEvent.getLastName())
                    .isActive(true)
                    .build();

            userRepository.save(newUser);
            log.info("User được tạo thành công: {}", newUser);
        } catch (Exception e) {
            log.error("Lỗi khi xử lý message tạo user: {}", e.getMessage(), e);
        }
    }
    @KafkaListener(topics = "${kafka.topic.user-login}", groupId = "user-service", containerFactory = "loginKafkaListenerContainerFactory")
    public void handleLoginEvent(LoginEventDTO loginEvent) {
        userRepository.findByKeycloakId(loginEvent.getKeycloakId())
                .ifPresent(user -> {
                    user.setLastLogin(new Date(loginEvent.getTimestamp()));
                    userRepository.save(user);
                    log.info("Updated last_login for user with keycloakId: {}", loginEvent.getKeycloakId());
                });
    }

    //get info user by token login
    public UserInfoDTO getUserInfo(Authentication authentication) {
        String keycloakId = ((Jwt)authentication.getPrincipal()).getSubject();
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));
        return UserInfoDTO.builder()
                .keycloakId(user.getKeycloakId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .username(user.getUsername())
                .bio(user.getBio())
                .image(user.getProfilePicture())
                .build();
    }

    public UserUpdateDTO updateUser(UserUpdateDTO userUpdateDTO, Authentication authentication) {
        String keycloakId = ((Jwt)authentication.getPrincipal()).getSubject();
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        user.setFirstName(userUpdateDTO.getFirstName());
        user.setLastName(userUpdateDTO.getLastName());
        user.setBio(userUpdateDTO.getBio());
        user.setProfilePicture(userUpdateDTO.getImage());

        userRepository.save(user);
        return userUpdateDTO;
    }
}
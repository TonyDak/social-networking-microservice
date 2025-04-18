package com.example.userservice.service;

import com.example.userservice.dto.*;
import com.example.userservice.model.User;
import com.example.userservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final KafkaTemplate<String, UserEventDTO> userUpdateDTOKafkaTemplate;
    private final KafkaTemplate<String, EmailVerificationResponseDTO> emailVerificationResponseKafkaTemplate;

    @Value("${kafka.topic.email-verification-response}")
    private String emailVerificationResponseTopic;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");


    @KafkaListener(topics = "${kafka.topic.user-creation}", groupId = "user-service", containerFactory = "userEventkafkaListenerContainerFactory")
    public void consumeUserCreationEvent(UserEventDTO userEvent) {
        try {
            log.info("Nhận message tạo user: {}", userEvent);

            // Kiểm tra user đã tồn tại chưa
            if (userRepository.existsByEmail(userEvent.getEmail())) {
                log.warn("User với email {} đã tồn tại", userEvent.getEmail());
                return;
            }
            // kiểm tra số điện thoại đã tồn tại chưa
            if (userRepository.existsByPhoneNumber(userEvent.getPhoneNumber())) {
                log.warn("User với số điện thoại {} đã tồn tại", userEvent.getPhoneNumber());
                return;
            }


            // Tạo và lưu user mới
            User newUser = User.builder()
                    .keycloakId(userEvent.getKeycloakId())
                    .email(userEvent.getEmail())
                    .firstName(userEvent.getFirstName())
                    .lastName(userEvent.getLastName())
                    .gender(userEvent.getGender())
                    .dateOfBirth(userEvent.getDateOfBirth() != null
                            ? LocalDate.parse(userEvent.getDateOfBirth(), DATE_FORMATTER)
                            : null)
                    .isActive(true)
                    .phoneNumber(userEvent.getPhoneNumber())
                    .isProfileComplete(userEvent.isProfileComplete())
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
                    user.setLastActivity(new Date(loginEvent.getTimestamp()));
                    userRepository.save(user);
                    log.info("Updated last_login for user with keycloakId: {}", loginEvent.getKeycloakId());
                });
    }

    //get info user by token login
    public UserInfoDTO getUserInfo(Authentication authentication) {
        try {
            if (authentication == null || authentication.getPrincipal() == null) {
                log.error("Authentication or principal is null");
                throw new RuntimeException("Authentication information is missing");
            }

            if (!(authentication.getPrincipal() instanceof Jwt)) {
                log.error("Principal is not a Jwt token: {}", authentication.getPrincipal().getClass());
                throw new RuntimeException("Invalid authentication type");
            }

            String keycloakId = ((Jwt)authentication.getPrincipal()).getSubject();
            log.info("User keycloakId: {}", keycloakId);
            log.debug("Looking up user with keycloakId: {}", keycloakId);

            User user = userRepository.findByKeycloakId(keycloakId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            return UserInfoDTO.builder()
                    .keycloakId(user.getKeycloakId())
                    .email(user.getEmail())
                    .firstName(user.getFirstName())
                    .lastName(user.getLastName())
                    .gender(String.valueOf(user.getGender()))
                    .dateOfBirth(String.valueOf(user.getDateOfBirth()))
                    .phoneNumber(user.getPhoneNumber())
                    .bio(user.getBio())
                    .image(user.getProfilePicture())
                    .isProfileComplete(user.getIsProfileComplete())
                    .build();
        } catch (Exception e) {
            log.error("Error retrieving user info: {}", e.getMessage(), e);
            throw new RuntimeException("Error retrieving user information: " + e.getMessage(), e);
        }
    }

    public UserUpdateDTO updateUser(UserUpdateDTO userUpdateDTO, Authentication authentication) {
        String keycloakId = ((Jwt)authentication.getPrincipal()).getSubject();
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));
        // Kiểm tra số điện thoại đã tồn tại chưa
        if (userUpdateDTO.getPhoneNumber() != null && !userUpdateDTO.getPhoneNumber().equals(user.getPhoneNumber())) {
            if (userRepository.existsByPhoneNumber(userUpdateDTO.getPhoneNumber())) {
                throw new RuntimeException("Số điện thoại đã tồn tại");
            }
        }

        user.setFirstName(userUpdateDTO.getFirstName());
        user.setLastName(userUpdateDTO.getLastName());
        user.setBio(userUpdateDTO.getBio());
        user.setProfilePicture(userUpdateDTO.getImage());
        user.setGender(userUpdateDTO.getGender());
        user.setDateOfBirth(userUpdateDTO.getDateOfBirth() != null
                ? LocalDate.parse(userUpdateDTO.getDateOfBirth(), DATE_FORMATTER)
                : null);
        user.setPhoneNumber(userUpdateDTO.getPhoneNumber());
        user.setIsProfileComplete(true);
        // Cập nhật thời gian hoạt động cuối cùng
        user.setLastActivity(new Date());

        userRepository.save(user);

        //send update user on keycloak
        UserEventDTO userEventDTO = new UserEventDTO(
                user.getKeycloakId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhoneNumber()
        );
        userUpdateDTOKafkaTemplate.send("user-update-topic", user.getKeycloakId() ,userEventDTO);
        return userUpdateDTO;
    }

    @KafkaListener(topics = "${kafka.topic.email-verification-request}",
            groupId = "user-service",
            containerFactory = "emailVerificationKafkaListenerContainerFactory")
    public void handleEmailVerificationRequest(EmailVerificationRequestDTO request) {
        log.info("Nhận yêu cầu kiểm tra email: {}", request.getEmail());

        try {
            boolean emailExists = userRepository.existsByEmail(request.getEmail());

            EmailVerificationResponseDTO response = EmailVerificationResponseDTO.builder()
                    .email(request.getEmail())
                    .correlationId(request.getCorrelationId())
                    .exists(emailExists)
                    .build();

            emailVerificationResponseKafkaTemplate.send(emailVerificationResponseTopic, request.getEmail(), response)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Không thể gửi phản hồi kiểm tra email: {}", ex.getMessage());
                        } else {
                            log.info("Đã gửi phản hồi kiểm tra email: {} - Tồn tại: {}",
                                    request.getEmail(), emailExists);
                        }
                    });
        } catch (Exception e) {
            log.error("Lỗi xử lý yêu cầu kiểm tra email: {}", e.getMessage(), e);
        }
    }
    public ResponseEntity<?> findUserbyPhoneNumber(String phoneNumber) {
        log.info("Đang tìm user với số điện thoại: {}", phoneNumber);
        Optional<User> userOptional = userRepository.findByPhoneNumber(phoneNumber);

        if (userOptional.isEmpty()) {
            log.warn("Không tìm thấy user với số điện thoại: {}", phoneNumber);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        log.info("Đã tìm thấy user: {}", userOptional.get().getEmail());
        User user = userOptional.get();
        UserInfoDTO userInfoDTO = UserInfoDTO.builder()
                .keycloakId(user.getKeycloakId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .gender(String.valueOf(user.getGender()))
                .dateOfBirth(String.valueOf(user.getDateOfBirth()))
                .phoneNumber(user.getPhoneNumber())
                .bio(user.getBio())
                .image(user.getProfilePicture())
                .isProfileComplete(user.getIsProfileComplete())
                .build();
        return ResponseEntity.ok(userInfoDTO);
    }

    //get user by keycloakId
    public ResponseEntity<?> findUserbyKeycloakId(String keycloakId){
        log.info("Đang tìm user với keycloakId: {}", keycloakId);
        Optional<User> userOptional = userRepository.findByKeycloakId(keycloakId);

        if (userOptional.isEmpty()) {
            log.warn("Không tìm thấy user với keycloakId: {}", keycloakId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        log.info("Đã tìm thấy user: {}", userOptional.get().getEmail());
        User user = userOptional.get();
        UserInfoDTO userInfoDTO = UserInfoDTO.builder()
                .keycloakId(user.getKeycloakId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .gender(String.valueOf(user.getGender()))
                .dateOfBirth(String.valueOf(user.getDateOfBirth()))
                .phoneNumber(user.getPhoneNumber())
                .bio(user.getBio())
                .image(user.getProfilePicture())
                .isProfileComplete(user.getIsProfileComplete())
                .build();
        return ResponseEntity.ok(userInfoDTO);
    }
}
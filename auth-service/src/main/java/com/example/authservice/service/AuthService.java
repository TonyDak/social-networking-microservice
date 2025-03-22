package com.example.authservice.service;


import ch.qos.logback.classic.spi.IThrowableProxy;
import com.example.authservice.dto.*;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    private final KeycloakService keycloakService;
    private final WebClient.Builder webClientBuilder;
    private final KafkaTemplate<String, UserEventDTO> CreateKafkaTemplate;
    private final KafkaTemplate<String, LoginEventDTO> LoginKafkaTemplate;

    @Value("${keycloak.auth-server-url}")
    private String authServerUrl;

    @Value("${keycloak.realm}")
    private String realm;

    @Value("${keycloak.resource}")
    private String clientId;

    @Value("${keycloak.credentials.secret}")
    private String clientSecret;

    @Value("${kafka.topic.user-creation}")
    private String userCreationTopic;

    @Value("${kafka.topic.user-login}")
    private String userLoginTopic;

    public ResponseEntity<?> registerUser(RegisterRequestDTO request) {
        Response response = keycloakService.createUser(request);
        int statusCode = response.getStatus();
        if (statusCode == 201) {
            String keycloakId = extractKeycloakUserIdFromResponse(response);
            UserEventDTO userEvent = UserEventDTO.builder()
                    .keycloakId(keycloakId)
                    .email(request.getEmail())
                    .firstName(request.getFirstName())
                    .lastName(request.getLastName())
                    .username(request.getUsername())
                    .build();
            //send kafka message
            CreateKafkaTemplate.send(userCreationTopic, request.getEmail(), userEvent);

            return ResponseEntity.ok(request);
        }
        return ResponseEntity.status(statusCode).body(response);
    }

    private String extractKeycloakUserIdFromResponse(Response response) {
        // Get the location header which contains the user URI
        String location = response.getHeaderString("Location");
        // Extract the user ID from the location URI
        return location != null ? location.substring(location.lastIndexOf('/') + 1) : null;
    }

    public ResponseEntity<?> loginUser(LoginRequestDTO request) {
        MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        map.add("client_id", clientId);
        map.add("client_secret", clientSecret);
        map.add("grant_type", "password");
        map.add("username", request.getEmail());
        map.add("password", request.getPassword());

        String tokenUrl = authServerUrl + "/realms/" + realm + "/protocol/openid-connect/token";

        try {
            TokenResponseDTO tokenResponseDTO = webClientBuilder.build()
                    .post()
                    .uri(tokenUrl)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                    .bodyValue(map)
                    .retrieve()
                    .bodyToMono(TokenResponseDTO.class)
                    .block();

            if (tokenResponseDTO != null) {
                String keycloakId = extractSubjectFromToken(tokenResponseDTO.getAccessToken());
                LoginEventDTO loginEvent = LoginEventDTO.builder()
                        .keycloakId(keycloakId)
                        .timestamp(System.currentTimeMillis())
                        .build();
                //send kafka message
                LoginKafkaTemplate.send(userLoginTopic, keycloakId, loginEvent);
                return ResponseEntity.ok(tokenResponseDTO);
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Không nhận được token xác thực");
        } catch (WebClientResponseException ex) {
            log.error("Đăng nhập thất bại: {}", ex.getMessage());

            if (ex.getStatusCode().is4xxClientError()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Email hoặc mật khẩu không chính xác");
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Lỗi hệ thống: Xảy ra lỗi khi xử lý yêu cầu đăng nhập");
            }
        } catch (Exception ex) {
            log.error("Lỗi không xác định khi đăng nhập: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Lỗi hệ thống: Xảy ra lỗi khi xử lý yêu cầu đăng nhập");
        }
    }

    private String extractSubjectFromToken(String token) {
        // Basic JWT token parsing to extract subject claim
        String payload = token.split("\\.")[1];
        String decodedPayload = new String(java.util.Base64.getDecoder().decode(payload));

        // Use a JSON parser or regex to extract the "sub" claim
        // This is a simplified version - consider using a JWT library
        int start = decodedPayload.indexOf("\"sub\":\"") + 7;
        int end = decodedPayload.indexOf("\"", start);
        return decodedPayload.substring(start, end);
    }

    public ResponseEntity<?> logoutUser(String refreshToken) {
        MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        map.add("client_id", clientId);
        map.add("client_secret", clientSecret);
        map.add("refresh_token", refreshToken);

        String logoutUrl = authServerUrl + "/realms/" + realm + "/protocol/openid-connect/logout";

        try {
            webClientBuilder.build()
                    .post()
                    .uri(logoutUrl)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                    .bodyValue(map)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block();
            return ResponseEntity.ok("Đã đăng xuất thành công");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Lỗi hệ thống: Xảy ra lỗi khi đăng xuất");
        }
    }

    @KafkaListener(topics = "${kafka.topic.user-update}", groupId = "auth-service")
    public void handleUpdateUserEvent(UserEventDTO userEvent) {
        try{
            keycloakService.updateUser(userEvent);
            log.info("Đã cập nhật người dùng trong Keycloak: {}", userEvent.getKeycloakId());
        } catch (Exception e) {
            log.error("Không thể cập nhật người dùng trên Keycloak: {}", e.getMessage(), e);
        }
    }

    //forgot password
    public ResponseEntity<?> forgotPassword(ForgotPasswordRequestDTO email) {
        Response response = keycloakService.updatePassword(email);
        int statusCode = response.getStatus();
        if (statusCode == 200) {
            return ResponseEntity.status(statusCode).body(response);
        }
        return ResponseEntity.status(statusCode).body(response);
    }

    public ResponseEntity<?> refreshToken(String refreshToken) {
        MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        map.add("client_id", clientId);
        map.add("client_secret", clientSecret);
        map.add("grant_type", "refresh_token");
        map.add("refresh_token", refreshToken);

        String tokenUrl = authServerUrl + "/realms/" + realm + "/protocol/openid-connect/token";

        try {
            TokenResponseDTO tokenResponseDTO = webClientBuilder.build()
                    .post()
                    .uri(tokenUrl)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                    .bodyValue(map)
                    .retrieve()
                    .bodyToMono(TokenResponseDTO.class)
                    .block();

            if (tokenResponseDTO != null) {
                return ResponseEntity.ok(tokenResponseDTO);
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Không thể làm mới token");
        } catch (WebClientResponseException ex) {
            log.error("Làm mới token thất bại: {}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Refresh token không hợp lệ hoặc đã hết hạn");
        } catch (Exception ex) {
            log.error("Lỗi không xác định khi làm mới token: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Lỗi hệ thống khi làm mới token");
        }
    }
}

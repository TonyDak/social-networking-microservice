package com.example.authservice.service;


import com.example.authservice.dto.*;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
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
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    private final KeycloakService keycloakService;
    private final WebClient.Builder webClientBuilder;
    private final KafkaTemplate<String, UserEventDTO> CreateKafkaTemplate;
    private final KafkaTemplate<String, LoginEventDTO> LoginKafkaTemplate;
    private final Cache<String, Long> recentLogins = Caffeine.newBuilder()
            .expireAfterWrite(30, TimeUnit.MINUTES)
            .maximumSize(10000)
            .build();
    private final long LOGIN_CACHE_DURATION = 30*60*1000; // 30 minutes


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

    @Value("${spring.security.oauth2.redirect-uri}")
    private String redirectUri;

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
        //check email already exists
        if (!keycloakService.isEmailExist(request.getEmail())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Email chưa được đăng ký");
        }

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
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Lỗi hệ thống: Xảy ra lỗi khi xử lý yêu cầu đăng nhập");
        } catch (WebClientResponseException ex) {
            if (ex.getStatusCode().is4xxClientError()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Mật khẩu không chính xác");
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

    public ResponseEntity<?> processGoogleLogin(String code) {
        if (code == null || code.isEmpty()) {
            return ResponseEntity.badRequest().body("Mã code không hợp lệ");
        }

        MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        map.add("client_id", clientId);
        map.add("client_secret", clientSecret);
        map.add("grant_type", "authorization_code");
        map.add("code", code);
        map.add("redirect_uri", redirectUri); // URL ứng dụng của bạn

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
                Map<String, Object> userInfo = getUserInfoFromToken(tokenResponseDTO.getAccessToken());

                cacheFirstTimeLoginAttempt(keycloakId, (String) userInfo.get("email"));
                synchronizeNewUserData(keycloakId, userInfo);

                // Ghi nhận sự kiện đăng nhập qua Kafka
                LoginEventDTO loginEvent = LoginEventDTO.builder()
                        .keycloakId(keycloakId)
                        .timestamp(System.currentTimeMillis())
                        .authProvider("google")
                        .build();

                LoginKafkaTemplate.send(userLoginTopic, keycloakId, loginEvent);

                return ResponseEntity.ok(tokenResponseDTO);
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Không nhận được token xác thực");
        } catch (Exception ex) {
            log.error("Lỗi đăng nhập Google: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Lỗi xử lý đăng nhập Google");
        }
    }
    // Phương thức để kiểm tra thông tin người dùng từ token
    private Map<String, Object> getUserInfoFromToken(String accessToken) {
        String userInfoUrl = authServerUrl + "/realms/" + realm + "/protocol/openid-connect/userinfo";

        return webClientBuilder.build()
                .get()
                .uri(userInfoUrl)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .block();
    }

    public ResponseEntity<?> getGoogleAuthUrl() {
        String authUrl = authServerUrl +
                "/realms/" + realm +
                "/protocol/openid-connect/auth" +
                "?client_id=" + clientId +
                "&redirect_uri=" + redirectUri + // Your frontend callback URL
                "&response_type=code" +
                "&scope=openid email profile" +
                "&kc_idp_hint=google"; // This is the important parameter for Keycloak to use Google

        return ResponseEntity.ok(new GoogleAuthUrlDTO(authUrl));
    }
    private void synchronizeNewUserData(String keycloakId, Map<String, Object> userInfo) {
        String email = (String) userInfo.get("email");

        // Tạo event với đầy đủ thông tin
        UserEventDTO userEvent = UserEventDTO.builder()
                .keycloakId(keycloakId)
                .email(email)
                .firstName((String) userInfo.getOrDefault("given_name", ""))
                .lastName((String) userInfo.getOrDefault("family_name", ""))
                .provider("google") // Thêm thông tin provider
                .build();

        // Kiểm tra đã đăng nhập gần đây chỉ để ghi log
        boolean recentLogin = isRecentLogin(keycloakId, email);
        log.info("Đồng bộ user - KeycloakID: {}, Email: {}, ĐăngNhậpGầnĐây: {}",
                keycloakId, email, recentLogin);

        // Luôn gửi sự kiện với cơ chế retry
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                CreateKafkaTemplate.send(userCreationTopic, email, userEvent).get(5, java.util.concurrent.TimeUnit.SECONDS);
                log.info("Đã gửi sự kiện đồng bộ user thành công: {}", keycloakId);
                // Cập nhật cache sau khi thành công
                cacheFirstTimeLoginAttempt(keycloakId, email);
                return;
            } catch (Exception e) {
                log.warn("Lần thử {} - Lỗi gửi sự kiện đồng bộ user: {}", attempt+1, e.getMessage());
                try { Thread.sleep(500); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
            }
        }
        log.error("Không thể gửi sự kiện đồng bộ user sau 3 lần thử: {}", keycloakId);
    }


    private void cacheFirstTimeLoginAttempt(String keycloakId, String email) {
        String cacheKey = keycloakId + ":" + email;
        recentLogins.put(cacheKey, System.currentTimeMillis());
    }

    private boolean isRecentLogin(String keycloakId, String email) {
        String cacheKey = keycloakId + ":" + email;
        Long lastLogin = recentLogins.getIfPresent(cacheKey);
        long currentTime = System.currentTimeMillis();

        return lastLogin != null && currentTime - lastLogin <= LOGIN_CACHE_DURATION;
    }
}

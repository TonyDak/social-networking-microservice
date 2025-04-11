package com.example.authservice.service;


import com.example.authservice.dto.*;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.keycloak.representations.idm.UserRepresentation;
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

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    private final KeycloakService keycloakService;
    private final WebClient.Builder webClientBuilder;
    private final KafkaTemplate<String, UserEventDTO> CreateKafkaTemplate;
    private final KafkaTemplate<String, LoginEventDTO> LoginKafkaTemplate;
    private final KafkaTemplate<String, EmailVerificationRequestDTO> emailVerificationKafkaTemplate;
    private final ScheduledExecutorService retryExecutor = Executors.newScheduledThreadPool(2);
    private final Cache<String, CompletableFuture<Boolean>> pendingEmailVerifications = Caffeine.newBuilder()
            .expireAfterWrite(30, TimeUnit.SECONDS)
            .maximumSize(1000)
            .build();

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

    @Value("${kafka.topic.email-verification-request}")
    private String emailVerificationRequestTopic;

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
                    .phoneNumber(request.getPhoneNumber())
                    .gender(request.getGender())
                    .dateOfBirth(request.getDateOfBirth())
                    .isProfileComplete(true)
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
                tokenResponseDTO.setProfileComplete(true);
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
        Response response = keycloakService.SendResetPassword(email);
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

    private final Cache<String, Boolean> usedAuthCodes = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(1000)
            .build();
    public ResponseEntity<?> processGoogleLogin(String code, String redirectUri) {
        if (code == null || code.isEmpty()) {
            return ResponseEntity.badRequest().body("Mã code không hợp lệ");
        }
        // Kiểm tra mã đã sử dụng chưa
        if (Boolean.TRUE.equals(usedAuthCodes.getIfPresent(code))) {
            log.warn("Phát hiện mã code đã được sử dụng: {}", code);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Mã xác thực đã được sử dụng");
        }

        // Đánh dấu mã đã sử dụng ngay lập tức
        usedAuthCodes.put(code, true);
        MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        map.add("client_id", clientId);
        map.add("client_secret", clientSecret);
        map.add("grant_type", "authorization_code");
        map.add("code", code);
        map.add("redirect_uri", redirectUri);

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
                String email = (String) userInfo.get("email");

                // Kiểm tra xem người dùng đã tồn tại trong Keycloak chưa
                if (keycloakService.isEmailExist(email)) {
                    log.info("Người dùng với email {} đã tồn tại, đang liên kết với tài khoản Google", email);

                    // Tìm người dùng theo email
                    UserRepresentation existingUser = keycloakService.findUserByEmail(email);
                    if (existingUser != null) {
                        // Liên kết tài khoản Google với tài khoản hiện có
                        boolean linked = keycloakService.linkGoogleIdentity(existingUser.getId(), tokenResponseDTO.getAccessToken(), email);
                        if (linked) {
                            log.info("Đã liên kết tài khoản Google thành công cho người dùng: {}", existingUser.getId());
                        } else {
                            log.warn("Không thể liên kết tài khoản Google cho người dùng: {}", existingUser.getId());
                        }
                    }
                }
                boolean existsInUserService = checkEmailExistsInUserService(email).get(5, TimeUnit.SECONDS);

                if (existsInUserService) {
                    log.info("Email {} tồn tại trong user-service", email);
                } else {
                    log.info("Người dùng mới với email {} chưa tồn tại, tạo mới tài khoản", email);
                    // Create new user in both systems
                    UserEventDTO userEvent = UserEventDTO.builder()
                            .keycloakId(keycloakId)
                            .email(email)
                            .firstName((String) userInfo.getOrDefault("given_name", ""))
                            .lastName((String) userInfo.getOrDefault("family_name", ""))
                            .isProfileComplete(false)
                            .provider("google")
                            .build();
                    tokenResponseDTO.setProfileComplete(userEvent.isProfileComplete());
                    CreateKafkaTemplate.send(userCreationTopic, email, userEvent);
                }


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
        } catch (WebClientResponseException ex) {
            log.error("Lỗi đăng nhập Google: {}", ex.getMessage(), ex);
            if (ex.getStatusCode().is4xxClientError()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Mã code không hợp lệ hoặc đã hết hạn");
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Lỗi xử lý đăng nhập Google");
            }
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

    public ResponseEntity<?> getGoogleAuthUrl() throws UnsupportedEncodingException {
        String scopes = "openid email profile";
        // Sử dụng URL frontend làm redirect_uri
        String authUrl = authServerUrl +
                "/realms/" + realm +
                "/protocol/openid-connect/auth" +
                "?client_id=" + clientId +
                "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8.toString()) +
                "&response_type=code" +
                "&scope=" + URLEncoder.encode(scopes, StandardCharsets.UTF_8.toString()) +
                "&kc_idp_hint=google";

        return ResponseEntity.ok(new GoogleAuthUrlDTO(authUrl));
    }
    public CompletableFuture<Boolean> checkEmailExistsInUserService(String email) {
        String correlationId = UUID.randomUUID().toString();
        CompletableFuture<Boolean> resultFuture = new CompletableFuture<>();
        pendingEmailVerifications.put(correlationId, resultFuture);

        EmailVerificationRequestDTO request = EmailVerificationRequestDTO.builder()
                .email(email)
                .correlationId(correlationId)
                .build();

        emailVerificationKafkaTemplate.send(emailVerificationRequestTopic, email, request)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Không thể gửi yêu cầu kiểm tra email: {}", ex.getMessage());
                        pendingEmailVerifications.invalidate(correlationId);
                        resultFuture.completeExceptionally(ex);
                    } else {
                        log.debug("Đã gửi yêu cầu kiểm tra email: {}", email);
                        // Set timeout to avoid hanging indefinitely
                        scheduleTimeout(correlationId, resultFuture);
                    }
                });

        return resultFuture;
    }

    private void scheduleTimeout(String correlationId, CompletableFuture<Boolean> future) {
        retryExecutor.schedule(() -> {
            CompletableFuture<Boolean> pendingFuture = pendingEmailVerifications.getIfPresent(correlationId);
            if (pendingFuture != null && !pendingFuture.isDone()) {
                log.warn("Timeout khi chờ phản hồi kiểm tra email: {}", correlationId);
                pendingEmailVerifications.invalidate(correlationId);
                future.complete(false); // Default to false on timeout
            }
        }, 5, TimeUnit.SECONDS);
    }

    @KafkaListener(topics = "${kafka.topic.email-verification-response}", groupId = "auth-service" ,
            containerFactory = "emailVerificationResponseKafkaListenerContainerFactory")
    public void handleEmailVerificationResponse(EmailVerificationResponseDTO response) {
        log.debug("Đã nhận phản hồi kiểm tra email: {} - Tồn tại: {}",
                response.getEmail(), response.isExists());

        CompletableFuture<Boolean> resultFuture = pendingEmailVerifications.getIfPresent(response.getCorrelationId());

        if (resultFuture != null) {
            resultFuture.complete(response.isExists());
            pendingEmailVerifications.invalidate(response.getCorrelationId());
        } else {
            log.warn("Nhận được phản hồi kiểm tra email không mong đợi hoặc hết hạn: {}", response.getCorrelationId());
        }
    }
}

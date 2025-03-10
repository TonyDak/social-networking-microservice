package com.example.authservice.service;


import com.example.authservice.dto.*;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import org.keycloak.events.Event;
import org.keycloak.events.EventType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.config.server.environment.JdbcEnvironmentRepository;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;

@Service
@RequiredArgsConstructor
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

    public ResponseEntity<String> registerUser(RegisterRequestDTO request) {
        Response response = keycloakService.createUser(
                request.getUsername(),
                request.getEmail(),
                request.getFirstName(),
                request.getLastName(),
                request.getPassword()
        );

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
            return ResponseEntity.ok("User registered successfully");
        }
        return ResponseEntity.status(statusCode)
                .body("Failed to register user: " + response.getStatusInfo().getReasonPhrase());
    }

    private String extractKeycloakUserIdFromResponse(Response response) {
        // Get the location header which contains the user URI
        String location = response.getHeaderString("Location");
        // Extract the user ID from the location URI
        return location != null ? location.substring(location.lastIndexOf('/') + 1) : null;
    }

    public TokenResponseDTO loginUser(LoginRequestDTO request) {
        MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        map.add("client_id", clientId);
        map.add("client_secret", clientSecret);
        map.add("grant_type", "password");
        map.add("username", request.getEmail());
        map.add("password", request.getPassword());

        String tokenUrl = authServerUrl + "/realms/" + realm + "/protocol/openid-connect/token";

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
        }
        return tokenResponseDTO;
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

    public ResponseEntity<String> logoutUser(String refreshToken) {
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
            return ResponseEntity.ok("Logged out successfully");
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Logout failed: " + e.getMessage());
        }
    }
}

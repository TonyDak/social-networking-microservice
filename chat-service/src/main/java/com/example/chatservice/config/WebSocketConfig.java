package com.example.chatservice.config;

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.keycloak.RSATokenVerifier;
import org.keycloak.adapters.springboot.KeycloakSpringBootProperties;
import org.keycloak.representations.AccessToken;
import com.sun.security.auth.UserPrincipal;
import org.keycloak.TokenVerifier;
import org.keycloak.common.VerificationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.net.URL;
import java.security.interfaces.RSAPublicKey;
import java.util.*;
import java.util.stream.Collectors;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private static final Logger logger = LoggerFactory.getLogger(WebSocketConfig.class);

    @Value("${keycloak.realm}")
    private String realm;

    @Value("${keycloak.resource}")
    private String clientId;

    @Value("${keycloak.auth-server-url}")
    private String authServerUrl;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.enableSimpleBroker("/topic", "/queue", "/user");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor != null && (
                        StompCommand.CONNECT.equals(accessor.getCommand()) ||
                                StompCommand.SUBSCRIBE.equals(accessor.getCommand()) ||
                                StompCommand.UNSUBSCRIBE.equals(accessor.getCommand()) ||
                                StompCommand.DISCONNECT.equals(accessor.getCommand()) ||
                                StompCommand.SEND.equals(accessor.getCommand())
                )) {
                    String token = accessor.getFirstNativeHeader("Authorization");
                    String userId = accessor.getFirstNativeHeader("X-User-Id");

                    if (token != null && token.startsWith("Bearer ")) {
                        String jwt = token.substring(7);
                        try {
                            // Parse JWT
                            SignedJWT signedJWT = SignedJWT.parse(jwt);

                            // Lấy public key từ JWKS endpoint của Keycloak
                            URL jwksURL = new URL(authServerUrl + "/realms/" + realm + "/protocol/openid-connect/certs");
                            JWKSet jwkSet = JWKSet.load(jwksURL);
                            JWK jwk = jwkSet.getKeyByKeyId(signedJWT.getHeader().getKeyID());

                            if (jwk == null) {
                                logger.error("Không tìm thấy JWK với key ID: {}", signedJWT.getHeader().getKeyID());
                                return null;
                            }

                            RSAPublicKey publicKey = ((RSAKey) jwk).toRSAPublicKey();
                            JWSVerifier verifier = new RSASSAVerifier(publicKey);

                            // Verify chữ ký
                            if (!signedJWT.verify(verifier)) {
                                logger.warn("Chữ ký JWT không hợp lệ");
                                return null;
                            }

                            // Kiểm tra thời gian hết hạn
                            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
                            Date exp = claims.getExpirationTime();
                            if (exp != null && exp.before(new Date())) {
                                logger.warn("Token đã hết hạn");
                                return null;
                            }

                            String tokenUserId = claims.getSubject();
                            String preferredUsername = claims.getStringClaim("preferred_username");
                            String email = claims.getStringClaim("email");

                            if (userId != null && !userId.equals(tokenUserId)) {
                                logger.warn("UserId không khớp: Header: {}, Token: {}", userId, tokenUserId);
                                return null;
                            }

                            if (userId == null) {
                                userId = tokenUserId;
                            }

                            // Trích xuất roles từ realm_access
                            List<GrantedAuthority> authorities = new ArrayList<>();
                            Map<String, Object> realmAccess = (Map<String, Object>) claims.getClaim("realm_access");
                            if (realmAccess != null && realmAccess.containsKey("roles")) {
                                List<String> roles = (List<String>) realmAccess.get("roles");
                                authorities = roles.stream()
                                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                                        .collect(Collectors.toList());
                            }

                            UsernamePasswordAuthenticationToken auth =
                                    new UsernamePasswordAuthenticationToken(userId, null, authorities);
                            Map<String, Object> details = Map.of(
                                    "preferredUsername", preferredUsername != null ? preferredUsername : "",
                                    "email", email != null ? email : ""
                            );
                            auth.setDetails(details);
                            accessor.setUser(auth);

                            logger.info("✅ WebSocket xác thực thành công cho người dùng: {}", userId);

                        } catch (Exception e) {
                            logger.error("❌ Lỗi xác thực JWT WebSocket: {}", e.getMessage(), e);
                            return null;
                        }
                    } else if (userId != null) {
                        // Dev mode không cần token
                        UsernamePasswordAuthenticationToken auth =
                                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());
                        accessor.setUser(auth);
                        logger.info("⚠️ WebSocket kết nối chỉ với userId (chế độ dev): {}", userId);
                    } else {
                        logger.warn("❌ Kết nối WebSocket không có xác thực hợp lệ");
                        return null;
                    }
                }
                return message;
            }
        });
    }


}
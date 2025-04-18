package com.example.apigateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoders;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtGrantedAuthoritiesConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import org.springframework.web.reactive.socket.client.TomcatWebSocketClient;
import org.springframework.web.reactive.socket.client.WebSocketClient;
import org.springframework.web.reactive.socket.server.RequestUpgradeStrategy;
import org.springframework.web.reactive.socket.server.upgrade.TomcatRequestUpgradeStrategy;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;

import java.util.Arrays;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}")
    private String issuerUri;

    @Bean
    public ReactiveJwtDecoder jwtDecoder() {
        return ReactiveJwtDecoders.fromIssuerLocation(issuerUri);
    }

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        ReactiveJwtAuthenticationConverter jwtAuthConverter = new ReactiveJwtAuthenticationConverter();
        jwtAuthConverter.setJwtGrantedAuthoritiesConverter(
                new ReactiveJwtGrantedAuthoritiesConverterAdapter(new KeycloakRoleConverter()));
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(exchanges -> exchanges
                        .pathMatchers("/api/auth/register", "/api/auth/login",
                                "/api/auth/forgot-password", "/api/auth/google-login-url",
                                "/api/auth/google-redirect", "/api/auth/refresh**", "/api/auth/logout-user**","/ws/**","/ws/info**", "ws").permitAll()
                        .anyExchange().authenticated()
                )
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter)))
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:3000"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-User-ID","X-Authorization"));
        configuration.setExposedHeaders(Arrays.asList("Authorization", "X-Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    @Primary
    WebSocketClient tomcatWebSocketClient() {
        return new TomcatWebSocketClient();
    }
    @Bean
    @Primary
    public RequestUpgradeStrategy requestUpgradeStrategy() {
        return new TomcatRequestUpgradeStrategy();
    }
}
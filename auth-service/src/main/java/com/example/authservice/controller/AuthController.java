package com.example.authservice.controller;

import com.example.authservice.dto.*;
import com.example.authservice.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.UnsupportedEncodingException;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    @Value("${spring.security.oauth2.redirect-uri}")
    private String redirectUri;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @Valid RegisterRequestDTO registerRequest) {
        return authService.registerUser(registerRequest);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequestDTO loginRequest) {
        return authService.loginUser(loginRequest);
    }

    //forgot password send email
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequestDTO email) {
        return authService.forgotPassword(email);
    }

    //logout
    @GetMapping("/logout-user")
    public ResponseEntity<?> logout(@RequestParam String refreshToken) {
        return authService.logoutUser(refreshToken);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestParam String refreshToken) {
        return authService.refreshToken(refreshToken);
    }
    @GetMapping("/google-redirect")
    public ResponseEntity<?> processGoogleLogin(
            @RequestParam("code") String code,
            @RequestParam(value = "redirect_uri", required = false) String redirectUri) {
        if (redirectUri == null || redirectUri.isEmpty()) {
            redirectUri = this.redirectUri;
        }
        return authService.processGoogleLogin(code, redirectUri);
    }
    @GetMapping("/google-login-url")
    public ResponseEntity<?> getGoogleLoginUrl() throws UnsupportedEncodingException {
        return authService.getGoogleAuthUrl();
    }
}

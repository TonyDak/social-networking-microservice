package com.example.authservice.controller;

import com.example.authservice.dto.ForgotPasswordRequestDTO;
import com.example.authservice.dto.TokenResponseDTO;
import com.example.authservice.dto.LoginRequestDTO;
import com.example.authservice.dto.RegisterRequestDTO;
import com.example.authservice.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

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
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestParam String refreshToken) {
        return authService.logoutUser(refreshToken);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestParam String refreshToken) {
        return authService.refreshToken(refreshToken);
    }
    @GetMapping("/google-redirect")
    public ResponseEntity<?> getGoogleToken(@RequestParam("code") String code) {
        return authService.processGoogleLogin(code);
    }
    @GetMapping("/google-login-url")
    public ResponseEntity<?> getGoogleLoginUrl() {
        return authService.getGoogleAuthUrl();
    }
}

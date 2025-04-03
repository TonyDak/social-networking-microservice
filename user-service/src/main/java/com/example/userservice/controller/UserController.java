package com.example.userservice.controller;


import com.example.userservice.dto.UserInfoDTO;
import com.example.userservice.dto.UserUpdateDTO;
import com.example.userservice.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        return ResponseEntity.ok(userService.getUserInfo(authentication));
    }

    //update user
    @PutMapping("/me/update")
    public ResponseEntity<?> updateUser(Authentication authentication, @RequestBody UserUpdateDTO userUpdateDTO) {
        return ResponseEntity.ok(userService.updateUser(userUpdateDTO, authentication));
    }
}

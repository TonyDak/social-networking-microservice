package com.example.userservice.controller;


import com.example.userservice.dto.PhoneRequestDTO;
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

    @PostMapping("/findby-phonenumber")
    public ResponseEntity<?> findUserByPhone(@RequestBody PhoneRequestDTO phoneRequestDTO) {
        return ResponseEntity.ok(userService.findUserbyPhoneNumber(phoneRequestDTO.getPhoneNumber()));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUserById(@PathVariable String userId) {
        return ResponseEntity.ok(userService.findUserbyKeycloakId(userId));
    }
}

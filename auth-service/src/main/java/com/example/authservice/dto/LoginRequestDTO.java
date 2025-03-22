package com.example.authservice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Value;

@Data
@AllArgsConstructor
@Value
@Valid
public class LoginRequestDTO {
    @Email(message = "Email should be valid")
    private String email;
    private String password;
}

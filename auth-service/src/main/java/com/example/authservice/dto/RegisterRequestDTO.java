package com.example.authservice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Value;


@Valid
@Data
@Value
@AllArgsConstructor
public class RegisterRequestDTO {

    @Email(message = "Email should be valid")
    private String email;

    @Size(min = 8, max = 16,message = "Password should have at least 6 characters")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$", message = "Password should have at least one uppercase letter, one lowercase letter and one digit")
    private String password;

    private String firstName;
    private String lastName;

}

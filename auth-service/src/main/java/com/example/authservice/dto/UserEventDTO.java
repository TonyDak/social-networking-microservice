package com.example.authservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEventDTO {
    private String keycloakId;
    private String email;
    private String firstName;
    private String lastName;
    private String gender;

    private String dateOfBirth;

    private String provider;
    private String phoneNumber;
    private boolean isProfileComplete;
}

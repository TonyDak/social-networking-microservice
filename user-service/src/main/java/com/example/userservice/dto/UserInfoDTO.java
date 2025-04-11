package com.example.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfoDTO {
    private String keycloakId;
    private String email;
    private String firstName;
    private String lastName;
    private String gender;
    private String dateOfBirth;
    private String bio;
    private String image;
    private String phoneNumber;
    private boolean isProfileComplete;
}

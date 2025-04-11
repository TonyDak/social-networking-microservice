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
public class UserEventDTO {
    private String keycloakId;
    private String email;
    private String firstName;
    private String lastName;
    private String gender;
    private String dateOfBirth;
    private String phoneNumber;
    private boolean isProfileComplete;

    public UserEventDTO(String keycloakId, String email, String firstName, String lastName) {
        this.keycloakId = keycloakId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

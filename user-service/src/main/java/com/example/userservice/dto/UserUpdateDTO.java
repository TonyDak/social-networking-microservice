package com.example.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserUpdateDTO {
    private String firstName;
    private String lastName;
    private String dateOfBirth;
    private String bio;
    private String image;
    private String phoneNumber;
    private String gender;
}

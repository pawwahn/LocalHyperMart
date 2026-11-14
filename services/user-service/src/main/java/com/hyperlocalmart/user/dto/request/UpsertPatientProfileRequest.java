package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpsertPatientProfileRequest {

    @NotBlank
    @Size(max = 120)
    private String displayName;

    @NotBlank
    @Size(max = 30)
    private String relation;

    @NotBlank
    @Size(max = 20)
    private String gender;

    private Integer ageYears;
    private LocalDate dateOfBirth;

    @Size(max = 400)
    private String notes;
}

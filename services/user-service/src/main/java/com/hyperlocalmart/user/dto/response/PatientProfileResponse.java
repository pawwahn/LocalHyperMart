package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class PatientProfileResponse {

    private UUID id;
    private String displayName;
    private String relation;
    private String gender;
    private Integer ageYears;
    private LocalDate dateOfBirth;
    private String notes;
    private boolean active;
}

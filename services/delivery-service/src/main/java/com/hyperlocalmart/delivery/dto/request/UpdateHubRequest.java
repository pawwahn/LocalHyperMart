package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateHubRequest {

    @NotBlank
    @Size(max = 255)
    private String name;

    @Size(max = 2000)
    private String address;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid Indian mobile number")
    private String phone;

    @NotBlank
    @Pattern(regexp = "^(ACTIVE|DISABLED)$", message = "status must be ACTIVE or DISABLED")
    private String status;

    @NotBlank
    @Pattern(
            regexp = "^(AADHAAR|VOTER_ID|DRIVING_LICENSE|PAN|OTHER)$",
            message = "govtIdType must be AADHAAR, VOTER_ID, DRIVING_LICENSE, PAN, or OTHER")
    private String govtIdType;

    /** Blank or masked (****1234) keeps the stored number. */
    @Size(max = 40)
    private String govtIdNumber;

    @NotBlank
    @Size(max = 120)
    private String reference1Name;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid reference 1 mobile number")
    private String reference1Phone;

    @NotBlank
    @Size(max = 120)
    private String reference2Name;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid reference 2 mobile number")
    private String reference2Phone;
}

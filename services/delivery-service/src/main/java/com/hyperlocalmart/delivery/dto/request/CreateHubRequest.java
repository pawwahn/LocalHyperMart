package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateHubRequest {

    @NotNull
    private UUID townId;

    @NotBlank
    @Size(max = 255)
    private String name;

    @Size(max = 2000)
    private String address;

    /** Public hub contact phone (also default admin login phone when adminPhone omitted). */
    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid Indian mobile number")
    private String phone;

    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid Indian mobile number")
    private String adminPhone;

    @Size(max = 100)
    private String adminFirstName;

    @Size(max = 100)
    private String adminLastName;

    /**
     * Optional. When blank, a one-time temp password is generated (HlM@ + last 4 of admin phone)
     * and returned once in the create response.
     */
    @Size(max = 100)
    private String adminPassword;
}

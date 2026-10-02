package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateVendorAgentRequest {

    @NotBlank
    @Size(max = 120)
    private String name;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid Indian mobile number")
    private String phone;

    @NotBlank
    @Size(min = 8, max = 100, message = "Password must be 8–100 characters")
    private String password;

    @Size(max = 30)
    private String govtIdType;

    @Size(max = 40)
    private String govtIdNumber;

    @Size(max = 120)
    private String reference1Name;

    @Pattern(regexp = "^$|^[6-9]\\d{9}$", message = "Invalid reference 1 mobile number")
    private String reference1Phone;

    @Size(max = 120)
    private String reference2Name;

    @Pattern(regexp = "^$|^[6-9]\\d{9}$", message = "Invalid reference 2 mobile number")
    private String reference2Phone;
}

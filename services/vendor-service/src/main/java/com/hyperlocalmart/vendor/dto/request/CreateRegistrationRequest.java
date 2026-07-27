package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateRegistrationRequest {

    @NotNull
    private UUID townId;

    @NotBlank
    @Size(max = 255)
    private String businessName;

    @Size(max = 255)
    private String ownerName;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid Indian mobile number")
    private String phone;

    @NotBlank
    @Size(max = 255)
    private String shopName;

    private String address;

    private String gstNumber;

    private String bankAccount;

    private String ifsc;
}

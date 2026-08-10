package com.hyperlocalmart.user.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateAddressRequest {

    @NotNull
    private UUID townId;

    @Size(max = 50)
    private String label;

    @NotBlank
    @Size(max = 100)
    private String recipientName;

    @NotBlank
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid Indian mobile number")
    private String recipientPhone;

    @NotBlank
    @Size(max = 255)
    private String line1;

    @Size(max = 255)
    private String line2;

    @NotBlank
    @Size(max = 255)
    private String landmark;

    @Size(max = 10)
    private String pincode;

    @JsonProperty("isDefault")
    private boolean isDefault;
}

package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterDeviceRequest {

    @NotBlank
    @Size(max = 512)
    private String fcmToken;

    @NotBlank
    @Pattern(regexp = "ANDROID|IOS|WEB")
    private String platform;

    @NotBlank
    @Pattern(regexp = "BUYER|VENDOR|DELIVERY|HUB")
    private String appType;
}

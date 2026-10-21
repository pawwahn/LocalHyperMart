package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GatewayAdminRequest {

    @NotBlank
    private String gateway;

    private boolean enabled;

    private String clientId;

    private String clientSecret;

    private String clientVersion;

    private String webhookSecret;

    private String webhookUsername;

    private String webhookPassword;

    /** sandbox or production */
    private String environment;
}

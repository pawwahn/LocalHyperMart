package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class GatewayAdminResponse {

    String gateway;
    String label;
    boolean enabled;
    String clientId;
    /** Never returned — use {@link #clientSecretConfigured}. */
    String clientSecret;
    boolean clientSecretConfigured;
    String clientVersion;
    String webhookSecret;
    boolean webhookSecretConfigured;
    String webhookUsername;
    String webhookPassword;
    boolean webhookPasswordConfigured;
    String environment;
}

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
    String clientSecret;
    String clientVersion;
    String webhookSecret;
    String webhookUsername;
    String webhookPassword;
    String environment;
}

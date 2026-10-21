package com.hyperlocalmart.payment.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GatewayCheckoutResponse {

    private String keyId;
    private String gateway;
    private String gatewayOrderId;
    private String paymentSessionId;
    private String redirectUrl;
    private String mode;
    private long amountPaise;
    private String currency;
    private String name;
    private String description;
    private String prefillContact;
    private String logoUrl;
}

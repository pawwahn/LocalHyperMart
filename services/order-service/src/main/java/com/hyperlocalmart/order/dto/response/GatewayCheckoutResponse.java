package com.hyperlocalmart.order.dto.response;

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
    private String gatewayOrderId;
    private long amountPaise;
    private String currency;
    private String name;
    private String description;
    private String prefillContact;
    private String logoUrl;
}

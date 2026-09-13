package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class ConsumeMembershipResponse {
    boolean applied;
    int creditsRemaining;
    BigDecimal waivedAmount;
}

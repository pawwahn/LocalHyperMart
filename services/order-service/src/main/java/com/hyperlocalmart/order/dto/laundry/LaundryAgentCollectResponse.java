package com.hyperlocalmart.order.dto.laundry;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class LaundryAgentCollectResponse {

    String paymentMethod;
    BigDecimal collectCashAmount;
    String paymentStatus;
    String laundryStatus;
    String laundryStatusLabel;
}

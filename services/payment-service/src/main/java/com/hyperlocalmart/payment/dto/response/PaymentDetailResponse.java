package com.hyperlocalmart.payment.dto.response;

import com.hyperlocalmart.payment.entity.PaymentGateway;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class PaymentDetailResponse {

    private UUID paymentId;
    private UUID orderId;
    private UUID townId;
    private PaymentStatus status;
    private PaymentGateway gateway;
    private BigDecimal amount;
    private String currency;
    private String gatewayPaymentId;
    private Instant paidAt;
}

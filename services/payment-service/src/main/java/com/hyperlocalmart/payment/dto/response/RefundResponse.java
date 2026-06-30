package com.hyperlocalmart.payment.dto.response;

import com.hyperlocalmart.payment.entity.RefundStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Value
@Builder
public class RefundResponse {

    UUID refundId;
    UUID paymentId;
    UUID orderId;
    BigDecimal amount;
    RefundStatus status;
    LocalDate expectedByDate;
}

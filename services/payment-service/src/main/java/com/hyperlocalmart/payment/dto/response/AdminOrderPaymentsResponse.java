package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class AdminOrderPaymentsResponse {

    private UUID orderId;
    private String orderNumber;
    private UUID townId;
    private UUID buyerId;
    private String buyerPhone;
    private String orderStatus;
    private String paymentStatus;
    private String paymentMethod;
    private BigDecimal orderTotal;

    private List<AdminPaymentAttemptResponse> payments;
}

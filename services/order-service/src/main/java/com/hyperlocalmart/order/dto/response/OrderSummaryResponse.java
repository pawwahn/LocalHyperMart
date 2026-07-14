package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class OrderSummaryResponse {

    private UUID orderId;
    private String orderNumber;
    private OrderStatus status;
    private String displayStatus;
    private BigDecimal totalAmount;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private Instant placedAt;
    private int itemCount;
}

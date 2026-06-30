package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.OrderStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class CreateOrderResponse {

    private UUID orderId;
    private String orderNumber;
    private OrderStatus status;
    private BigDecimal totalAmount;
    private PaymentInfoResponse payment;
}

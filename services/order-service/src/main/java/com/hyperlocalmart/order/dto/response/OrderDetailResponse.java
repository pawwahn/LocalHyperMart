package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class OrderDetailResponse {

    private UUID orderId;
    private String orderNumber;
    private OrderStatus status;
    private String displayStatus;
    private BigDecimal itemsSubtotal;
    private BigDecimal deliveryFee;
    private BigDecimal storeCreditApplied;
    private BigDecimal totalAmount;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private Map<String, Object> deliveryAddress;
    private List<OrderItemDetailResponse> items;
    private String invoicePdfUrl;
}

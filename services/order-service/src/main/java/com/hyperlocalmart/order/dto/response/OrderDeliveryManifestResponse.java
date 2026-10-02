package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.PaymentMethod;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class OrderDeliveryManifestResponse {

    private UUID orderId;
    private String orderNumber;
    private PaymentMethod paymentMethod;
    /** Cash to collect at the door for COD; null when paid online. */
    private BigDecimal collectCashAmount;
    private BigDecimal subtotal;
    private int totalItemCount;
    private List<DeliveryManifestLineResponse> items;
}

package com.hyperlocalmart.order.dto.response;

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
    private BigDecimal subtotal;
    private int totalItemCount;
    private List<DeliveryManifestLineResponse> items;
}

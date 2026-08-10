package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class DeliveryManifestResponse {

    private UUID assignmentId;
    private UUID orderId;
    private String orderNumber;
    private BigDecimal subtotal;
    private int totalItemCount;
    private List<DeliveryManifestLineResponse> items;
}

package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class VendorSubOrderResponse {

    private UUID subOrderId;
    private String subOrderNumber;
    private UUID orderId;
    private String orderNumber;
    private UUID vendorId;
    private UUID shopId;
    private VendorSubOrderStatus status;
    private BigDecimal subtotal;
    private Instant readyForPickupAt;
    private List<OrderItemDetailResponse> items;
}

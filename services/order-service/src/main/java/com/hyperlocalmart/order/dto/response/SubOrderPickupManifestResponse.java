package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class SubOrderPickupManifestResponse {

    private UUID subOrderId;
    private String subOrderNumber;
    private String orderNumber;
    private UUID shopId;
    private String shopName;
    private BigDecimal subtotal;
    private int totalItemCount;
    private List<PickupLineItemResponse> items;
}

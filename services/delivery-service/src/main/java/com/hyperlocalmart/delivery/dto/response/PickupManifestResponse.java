package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class PickupManifestResponse {

    private UUID assignmentId;
    private UUID subOrderId;
    private String subOrderNumber;
    private String orderNumber;
    private UUID shopId;
    private String shopName;
    private String shopAddress;
    private String shopPhone;
    private BigDecimal subtotal;
    private int totalItemCount;
    private List<PickupManifestLineResponse> items;
}

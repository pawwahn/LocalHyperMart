package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CodCashBreakdownResponse {

    UUID orderId;
    String orderNumber;
    Instant deliveredAt;
    /** Full cash collected from buyer at the door. */
    BigDecimal collectAmount;
    String custodianType;
    UUID hubId;
    UUID vendorId;
    List<VendorAllocation> vendorAllocations;

    @Value
    @Builder
    public static class VendorAllocation {
        UUID subOrderId;
        UUID vendorId;
        String subOrderNumber;
        BigDecimal goodsSubtotal;
        BigDecimal allocatedCash;
    }
}

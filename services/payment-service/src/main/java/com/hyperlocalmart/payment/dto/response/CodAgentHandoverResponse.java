package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CodAgentHandoverResponse {
    UUID handoverId;
    UUID agentId;
    String agentName;
    String agentPhone;
    String handoverDate;
    String custodianType;
    UUID hubId;
    UUID vendorId;
    BigDecimal declaredAmount;
    String status;
    List<Line> lines;

    @Value
    @Builder
    public static class Line {
        UUID orderId;
        String orderNumber;
        BigDecimal collectAmount;
        List<VendorSlice> vendorAllocations;
    }

    @Value
    @Builder
    public static class VendorSlice {
        UUID subOrderId;
        UUID vendorId;
        String subOrderNumber;
        BigDecimal goodsSubtotal;
        BigDecimal allocatedCash;
    }
}

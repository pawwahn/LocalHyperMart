package com.hyperlocalmart.payment.dto.response;

import com.hyperlocalmart.payment.entity.VendorSettlementAdjustmentStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class VendorSettlementAdjustmentResponse {

    private UUID id;
    private UUID townId;
    private UUID vendorId;
    private UUID shopId;
    private UUID claimId;
    private UUID orderId;
    private String orderNumber;
    private UUID orderItemId;
    private UUID subOrderId;
    private BigDecimal amount;
    private String reason;
    private VendorSettlementAdjustmentStatus status;
    private UUID appliedSettlementId;
    private Instant createdAt;
}

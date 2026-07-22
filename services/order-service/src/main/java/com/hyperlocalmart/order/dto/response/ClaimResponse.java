package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.ClaimResolution;
import com.hyperlocalmart.order.entity.ClaimStatus;
import com.hyperlocalmart.order.entity.ClaimType;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class ClaimResponse {

    private UUID claimId;
    private UUID orderId;
    private String orderNumber;
    private UUID orderItemId;
    private String itemName;
    private String shopName;
    private Integer quantity;
    private String unitCode;
    /** Suggested wallet credit = item line total (hub may credit up to this). */
    private BigDecimal suggestedCreditAmount;
    private UUID buyerId;
    private UUID townId;
    private ClaimType claimType;
    private ClaimStatus status;
    private String reason;
    private ClaimResolution resolution;
    private BigDecimal resolvedAmount;
    private String resolutionNote;
    private Instant createdAt;
    private Instant resolvedAt;
}

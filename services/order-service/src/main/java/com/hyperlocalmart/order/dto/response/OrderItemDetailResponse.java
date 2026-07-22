package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.OrderItemStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class OrderItemDetailResponse {

    private UUID orderItemId;
    private String name;
    private String shopName;
    private String unitCode;
    private int quantity;
    private BigDecimal lineTotal;
    private OrderItemStatus status;
    private String cancelReason;
    private Instant cancelledAt;
    private BigDecimal storeCreditAmount;
    /** True when buyer may cancel this line (shop still PLACED). */
    private boolean canCancel;
    /** True when buyer may file a claim on this delivered line. */
    private boolean canFileClaim;
}

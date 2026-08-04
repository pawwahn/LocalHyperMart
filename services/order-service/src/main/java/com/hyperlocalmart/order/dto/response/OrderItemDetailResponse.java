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
    /** True when this line was cancelled by the buyer (vendor must not restore). */
    private boolean cancelledByBuyer;
    /** True when vendor may restore this cancelled line. */
    private boolean canRestore;
    /** True when buyer may file a claim on this delivered line. */
    private boolean canFileClaim;
    /** True when buyer may rate this delivered line. */
    private boolean canRate;
    /** Buyer's existing rating for this line, if any (1–5). */
    private Integer myRating;
}

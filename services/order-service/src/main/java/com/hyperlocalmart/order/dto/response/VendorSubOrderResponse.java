package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    /** Other shops on the same parent order — name + bag status only. */
    private List<SiblingShop> siblingShops;
    private BigDecimal subtotal;
    private Instant placedAt;
    private Instant readyForPickupAt;
    private Instant vendorAgentDeliveryAt;
    /** True when this parent order has only this shop's bag (no split). */
    private boolean wholeOrderForShop;
    /** Town allows "Delivery by my agent" for vendors. */
    private boolean vendorAgentDeliveryEnabled;
    /** False when the town has no hub, or the hub is disabled. */
    private boolean townHubEnabled;
    /** Parent order flagged for vendor-agent delivery. */
    private boolean vendorAgentDelivery;
    /** Shop agent assigned for vendor-direct leg, if any. */
    private String vendorDirectAgentName;
    private String vendorDirectAgentPhone;
    private String vendorDirectAssignmentStatus;
    /** False when an active or completed vendor-direct assignment exists. */
    private boolean canAssignVendorAgent;
    /** Latest shop→agent nudge (PENDING / ACKNOWLEDGED). */
    private String vendorAgentAlertStatus;
    private Instant vendorAgentAlertAcknowledgedAt;
    private List<OrderItemDetailResponse> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SiblingShop {
        private String shopName;
        private VendorSubOrderStatus status;
    }
}

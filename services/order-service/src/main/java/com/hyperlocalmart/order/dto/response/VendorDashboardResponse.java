package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import lombok.Builder;
import lombok.Data;
import lombok.Singular;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class VendorDashboardResponse {

    private long orderCountToday;
    private long orderCountWeek;
    private BigDecimal earningsGross;
    private LocalDate from;
    private LocalDate to;
    @Singular("statusCount")
    private Map<String, Long> statusCounts;
    private List<VendorDashboardRecentOrder> recentOrders;

    @Data
    @Builder
    public static class VendorDashboardRecentOrder {
        private UUID subOrderId;
        private String subOrderNumber;
        private UUID orderId;
        private String orderNumber;
        private BigDecimal subtotal;
        private VendorSubOrderStatus status;
        private PaymentMethod paymentMethod;
        private PaymentStatus paymentStatus;
        private Instant placedAt;
        private int itemCount;
    }
}

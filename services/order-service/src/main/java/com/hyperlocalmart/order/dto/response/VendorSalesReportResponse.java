package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class VendorSalesReportResponse {

    private LocalDate from;
    private LocalDate to;
    private boolean includeItems;

    private long orderCount;
    private long itemQuantityTotal;
    private BigDecimal grossSales;
    private BigDecimal paidAmount;
    private BigDecimal pendingAmount;
    private BigDecimal refundedAmount;
    private BigDecimal rejectedAmount;

    private Map<String, Long> statusCounts;
    private Map<String, Long> paymentStatusCounts;
    private Map<String, Long> paymentMethodCounts;

    private List<VendorSalesReportRow> rows;
    private List<VendorItemPerformance> topSellingItems;
    private List<VendorItemPerformance> leastSellingItems;

    @Data
    @Builder
    public static class VendorItemPerformance {
        private String name;
        private String unit;
        private long quantitySold;
        private BigDecimal revenue;
        private long orderCount;
    }

    @Data
    @Builder
    public static class VendorSalesReportRow {
        private UUID subOrderId;
        private String subOrderNumber;
        private UUID orderId;
        private String orderNumber;
        private Instant placedAt;
        private VendorSubOrderStatus status;
        private PaymentMethod paymentMethod;
        private PaymentStatus paymentStatus;
        private BigDecimal subtotal;
        private int itemCount;
        private List<VendorSalesReportItem> items;
    }

    @Data
    @Builder
    public static class VendorSalesReportItem {
        private String name;
        private String unit;
        private int quantity;
        private BigDecimal unitPrice;
        private BigDecimal discountPrice;
        private BigDecimal lineTotal;
    }
}

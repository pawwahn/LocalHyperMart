package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.VendorSalesReportResponse;
import com.hyperlocalmart.order.dto.response.VendorSalesReportResponse.VendorSalesReportItem;
import com.hyperlocalmart.order.dto.response.VendorSalesReportResponse.VendorSalesReportRow;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorSalesReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;
    private static final int ITEM_RANK_LIMIT = 10;

    private final VendorSubOrderRepository vendorSubOrderRepository;

    @Transactional(readOnly = true)
    public VendorSalesReportResponse getSalesReport(
            UUID vendorId,
            LocalDate from,
            LocalDate to,
            boolean includeItems,
            PaymentStatus paymentStatus) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo;
        validateDateRange(rangeFrom, rangeTo);

        Instant rangeStart = rangeFrom.atStartOfDay(IST).toInstant();
        Instant rangeEnd = rangeTo.plusDays(1).atStartOfDay(IST).toInstant();

        List<VendorSubOrder> subOrders = vendorSubOrderRepository.findSalesReportByVendorId(
                vendorId, rangeStart, rangeEnd, paymentStatus);

        Map<String, Long> statusCounts = zeroStatusCounts();
        Map<String, Long> paymentStatusCounts = new HashMap<>();
        Map<String, Long> paymentMethodCounts = new HashMap<>();

        BigDecimal grossSales = BigDecimal.ZERO;
        BigDecimal paidAmount = BigDecimal.ZERO;
        BigDecimal pendingAmount = BigDecimal.ZERO;
        BigDecimal refundedAmount = BigDecimal.ZERO;
        BigDecimal rejectedAmount = BigDecimal.ZERO;
        long itemQuantityTotal = 0;

        List<VendorSalesReportRow> rows = new ArrayList<>();
        Map<String, ItemAgg> itemAggs = new HashMap<>();

        for (VendorSubOrder subOrder : subOrders) {
            statusCounts.merge(subOrder.getStatus().name(), 1L, Long::sum);

            PaymentStatus payStatus = subOrder.getOrder().getPaymentStatus();
            PaymentMethod payMethod = subOrder.getOrder().getPaymentMethod();
            if (payStatus != null) {
                paymentStatusCounts.merge(payStatus.name(), 1L, Long::sum);
            }
            if (payMethod != null) {
                paymentMethodCounts.merge(payMethod.name(), 1L, Long::sum);
            }

            BigDecimal subtotal = subOrder.getSubtotal() != null ? subOrder.getSubtotal() : BigDecimal.ZERO;
            boolean rejected = subOrder.getStatus() == VendorSubOrderStatus.VENDOR_REJECTED;
            BigDecimal rejectedDisplay = BigDecimal.ZERO;
            if (rejected) {
                // Prefer historical cancelled line totals (bag subtotal is often zeroed after reject).
                for (OrderItem item : subOrder.getItems()) {
                    rejectedDisplay = rejectedDisplay.add(
                            item.getLineTotal() != null ? item.getLineTotal() : BigDecimal.ZERO);
                }
                if (rejectedDisplay.compareTo(BigDecimal.ZERO) == 0) {
                    rejectedDisplay = subtotal;
                }
                rejectedAmount = rejectedAmount.add(rejectedDisplay);
            } else {
                grossSales = grossSales.add(subtotal);
                if (payStatus == PaymentStatus.PAID) {
                    paidAmount = paidAmount.add(subtotal);
                } else if (payStatus == PaymentStatus.REFUNDED) {
                    refundedAmount = refundedAmount.add(subtotal);
                } else {
                    pendingAmount = pendingAmount.add(subtotal);
                }
            }

            int itemCount = 0;
            List<VendorSalesReportItem> items = null;
            if (includeItems) {
                items = new ArrayList<>();
            }
            for (OrderItem item : subOrder.getItems()) {
                boolean cancelled = item.getStatus() == OrderItemStatus.CANCELLED;
                if (!cancelled) {
                    itemCount += item.getQuantity();
                }
                if (includeItems) {
                    items.add(VendorSalesReportItem.builder()
                            .name(item.getItemNameSnapshot())
                            .unit(item.getUnitCodeSnapshot())
                            .quantity(item.getQuantity())
                            .unitPrice(item.getUnitPrice())
                            .discountPrice(item.getDiscountPrice())
                            .lineTotal(item.getLineTotal())
                            .build());
                }
                if (!rejected && !cancelled) {
                    String key = (item.getItemNameSnapshot() == null ? "Item" : item.getItemNameSnapshot().trim())
                            + "|"
                            + (item.getUnitCodeSnapshot() == null ? "" : item.getUnitCodeSnapshot());
                    ItemAgg agg = itemAggs.computeIfAbsent(key, k -> new ItemAgg(
                            item.getItemNameSnapshot() == null ? "Item" : item.getItemNameSnapshot().trim(),
                            item.getUnitCodeSnapshot()));
                    agg.quantitySold += item.getQuantity();
                    agg.revenue = agg.revenue.add(
                            item.getLineTotal() != null ? item.getLineTotal() : BigDecimal.ZERO);
                    agg.orderIds.add(subOrder.getId());
                }
            }
            itemQuantityTotal += itemCount;

            rows.add(VendorSalesReportRow.builder()
                    .subOrderId(subOrder.getId())
                    .subOrderNumber(subOrder.getSubOrderNumber())
                    .orderId(subOrder.getOrder().getId())
                    .orderNumber(subOrder.getOrder().getOrderNumber())
                    .placedAt(subOrder.getOrder().getPlacedAt())
                    .status(subOrder.getStatus())
                    .paymentMethod(payMethod)
                    .paymentStatus(payStatus)
                    .subtotal(rejected ? rejectedDisplay : subtotal)
                    .itemCount(itemCount)
                    .items(items)
                    .build());
        }

        List<VendorSalesReportResponse.VendorItemPerformance> ranked = itemAggs.values().stream()
                .map(agg -> VendorSalesReportResponse.VendorItemPerformance.builder()
                        .name(agg.name)
                        .unit(agg.unit)
                        .quantitySold(agg.quantitySold)
                        .revenue(agg.revenue)
                        .orderCount(agg.orderIds.size())
                        .build())
                .sorted(Comparator
                        .comparingLong(VendorSalesReportResponse.VendorItemPerformance::getQuantitySold)
                        .reversed()
                        .thenComparing(VendorSalesReportResponse.VendorItemPerformance::getRevenue,
                                Comparator.reverseOrder()))
                .toList();

        List<VendorSalesReportResponse.VendorItemPerformance> top =
                ranked.stream().limit(ITEM_RANK_LIMIT).toList();
        List<VendorSalesReportResponse.VendorItemPerformance> least = ranked.stream()
                .sorted(Comparator
                        .comparingLong(VendorSalesReportResponse.VendorItemPerformance::getQuantitySold)
                        .thenComparing(VendorSalesReportResponse.VendorItemPerformance::getRevenue))
                .limit(ITEM_RANK_LIMIT)
                .toList();

        return VendorSalesReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .includeItems(includeItems)
                .orderCount(rows.size())
                .itemQuantityTotal(itemQuantityTotal)
                .grossSales(grossSales)
                .paidAmount(paidAmount)
                .pendingAmount(pendingAmount)
                .refundedAmount(refundedAmount)
                .rejectedAmount(rejectedAmount)
                .statusCounts(statusCounts)
                .paymentStatusCounts(paymentStatusCounts)
                .paymentMethodCounts(paymentMethodCounts)
                .rows(rows)
                .topSellingItems(top)
                .leastSellingItems(least)
                .build();
    }

    private static final class ItemAgg {
        private final String name;
        private final String unit;
        private long quantitySold;
        private BigDecimal revenue = BigDecimal.ZERO;
        private final java.util.HashSet<UUID> orderIds = new java.util.HashSet<>();

        private ItemAgg(String name, String unit) {
            this.name = name;
            this.unit = unit;
        }
    }

    private void validateDateRange(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' must be on or before 'to'");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
    }

    private Map<String, Long> zeroStatusCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (VendorSubOrderStatus status : VendorSubOrderStatus.values()) {
            counts.put(status.name(), 0L);
        }
        return counts;
    }
}

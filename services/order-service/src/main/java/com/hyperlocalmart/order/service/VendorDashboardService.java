package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.VendorDashboardResponse;
import com.hyperlocalmart.order.dto.response.VendorDashboardResponse.VendorDashboardRecentOrder;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorDashboardService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 90;
    private static final int RECENT_ORDERS_LIMIT = 10;

    private final VendorSubOrderRepository vendorSubOrderRepository;

    @Transactional(readOnly = true)
    public VendorDashboardResponse getDashboard(UUID vendorId, LocalDate from, LocalDate to) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo.minusDays(6);
        validateDateRange(rangeFrom, rangeTo);

        Instant rangeStart = startOfDay(rangeFrom);
        Instant rangeEnd = exclusiveEndOfDay(rangeTo);

        LocalDate today = LocalDate.now(IST);
        Instant todayStart = startOfDay(today);
        Instant todayEnd = exclusiveEndOfDay(today);
        Instant weekStart = startOfDay(today.minusDays(6));

        long orderCountToday = vendorSubOrderRepository.countPlacedSubOrdersByVendorIdAndPlacedAtBetween(
                vendorId, todayStart, todayEnd);
        long orderCountWeek = vendorSubOrderRepository.countPlacedSubOrdersByVendorIdAndPlacedAtBetween(
                vendorId, weekStart, todayEnd);

        BigDecimal earningsGross = vendorSubOrderRepository.sumEarningsByVendorIdAndPlacedAtBetween(
                vendorId, rangeStart, rangeEnd);

        Map<String, Long> statusCounts = toStatusCounts(
                vendorSubOrderRepository.countStatusBreakdownByVendorIdAndPlacedAtBetween(
                        vendorId, rangeStart, rangeEnd));

        List<VendorDashboardRecentOrder> recentOrders = vendorSubOrderRepository
                .findRecentByVendorIdAndPlacedAtBetween(
                        vendorId, rangeStart, rangeEnd, PageRequest.of(0, RECENT_ORDERS_LIMIT))
                .stream()
                .map(this::toRecentOrder)
                .toList();

        return VendorDashboardResponse.builder()
                .orderCountToday(orderCountToday)
                .orderCountWeek(orderCountWeek)
                .earningsGross(earningsGross)
                .from(rangeFrom)
                .to(rangeTo)
                .statusCounts(statusCounts)
                .recentOrders(recentOrders)
                .build();
    }

    private void validateDateRange(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' must be on or before 'to'");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
    }

    private Instant startOfDay(LocalDate date) {
        return date.atStartOfDay(IST).toInstant();
    }

    private Instant exclusiveEndOfDay(LocalDate date) {
        return date.plusDays(1).atStartOfDay(IST).toInstant();
    }

    private Map<String, Long> toStatusCounts(List<Object[]> rows) {
        Map<String, Long> counts = new HashMap<>();
        for (VendorSubOrderStatus status : VendorSubOrderStatus.values()) {
            counts.put(status.name(), 0L);
        }
        for (Object[] row : rows) {
            counts.put(((VendorSubOrderStatus) row[0]).name(), (Long) row[1]);
        }
        return counts;
    }

    private VendorDashboardRecentOrder toRecentOrder(VendorSubOrder subOrder) {
        int itemCount = subOrder.getItems().stream().mapToInt(OrderItem::getQuantity).sum();
        return VendorDashboardRecentOrder.builder()
                .subOrderId(subOrder.getId())
                .subOrderNumber(subOrder.getSubOrderNumber())
                .orderId(subOrder.getOrder().getId())
                .orderNumber(subOrder.getOrder().getOrderNumber())
                .subtotal(subOrder.getSubtotal())
                .status(subOrder.getStatus())
                .paymentMethod(subOrder.getOrder().getPaymentMethod())
                .paymentStatus(subOrder.getOrder().getPaymentStatus())
                .placedAt(subOrder.getOrder().getPlacedAt())
                .itemCount(itemCount)
                .build();
    }
}

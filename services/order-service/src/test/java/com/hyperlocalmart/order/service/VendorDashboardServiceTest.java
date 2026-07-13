package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VendorDashboardServiceTest {

    @Mock private VendorSubOrderRepository vendorSubOrderRepository;

    @InjectMocks
    private VendorDashboardService vendorDashboardService;

    @Test
    void getDashboard_aggregatesCountsAndEarnings() {
        UUID vendorId = UUID.randomUUID();
        LocalDate to = LocalDate.of(2026, 6, 24);
        LocalDate from = LocalDate.of(2026, 6, 18);

        VendorSubOrder subOrder = buildSubOrder(vendorId, "NRPT-00001", new BigDecimal("120.00"));

        when(vendorSubOrderRepository.countPlacedSubOrdersByVendorIdAndPlacedAtBetween(eq(vendorId), any(), any()))
                .thenReturn(3L, 12L);
        when(vendorSubOrderRepository.sumEarningsByVendorIdAndPlacedAtBetween(eq(vendorId), any(), any()))
                .thenReturn(new BigDecimal("2450.00"));
        when(vendorSubOrderRepository.countStatusBreakdownByVendorIdAndPlacedAtBetween(eq(vendorId), any(), any()))
                .thenReturn(List.<Object[]>of(new Object[] {VendorSubOrderStatus.PLACED, 2L}));
        when(vendorSubOrderRepository.findRecentByVendorIdAndPlacedAtBetween(
                eq(vendorId), any(), any(), any(Pageable.class)))
                .thenReturn(List.of(subOrder));

        var result = vendorDashboardService.getDashboard(vendorId, from, to);

        assertThat(result.getOrderCountToday()).isEqualTo(3L);
        assertThat(result.getOrderCountWeek()).isEqualTo(12L);
        assertThat(result.getEarningsGross()).isEqualByComparingTo("2450.00");
        assertThat(result.getFrom()).isEqualTo(from);
        assertThat(result.getTo()).isEqualTo(to);
        assertThat(result.getRecentOrders()).hasSize(1);
        assertThat(result.getRecentOrders().getFirst().getOrderNumber()).isEqualTo("NRPT-00001");
        assertThat(result.getStatusCounts().get("PLACED")).isEqualTo(2L);
    }

    @Test
    void getDashboard_rejectsInvalidDateRange() {
        UUID vendorId = UUID.randomUUID();
        assertThatThrownBy(() -> vendorDashboardService.getDashboard(
                vendorId, LocalDate.of(2026, 6, 24), LocalDate.of(2026, 6, 1)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("'from' must be on or before 'to'");
    }

    private VendorSubOrder buildSubOrder(UUID vendorId, String orderNumber, BigDecimal subtotal) {
        OrderItem item = OrderItem.builder()
                .itemNameSnapshot("Tomato")
                .quantity(2)
                .lineTotal(subtotal)
                .build();
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber(orderNumber)
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PAID)
                .placedAt(Instant.parse("2026-06-24T10:00:00Z"))
                .build();
        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(UUID.randomUUID())
                .vendorId(vendorId)
                .order(order)
                .subOrderNumber(orderNumber + "-1/1")
                .status(VendorSubOrderStatus.PLACED)
                .subtotal(subtotal)
                .items(List.of(item))
                .build();
        item.setVendorSubOrder(subOrder);
        return subOrder;
    }
}

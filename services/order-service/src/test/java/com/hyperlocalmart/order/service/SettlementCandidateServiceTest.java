package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettlementCandidateServiceTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @Mock
    private VendorSubOrderRepository vendorSubOrderRepository;

    @InjectMocks
    private SettlementCandidateService settlementCandidateService;

    @Test
    void listCandidates_queriesDeliveredWindowInIst() {
        UUID vendorId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();
        LocalDate from = LocalDate.of(2026, 7, 21);
        LocalDate to = LocalDate.of(2026, 8, 1);

        VendorSubOrder delivered = sample(VendorSubOrderStatus.DELIVERED, "NRPT/AP-010826-0001");
        when(vendorSubOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId),
                eq(from.atStartOfDay(IST).toInstant()),
                eq(to.plusDays(1).atStartOfDay(IST).toInstant())))
                .thenReturn(List.of(delivered));

        var response = settlementCandidateService.listCandidates(vendorId, townId, from, to);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getStatus()).isEqualTo(VendorSubOrderStatus.DELIVERED);

        ArgumentCaptor<Instant> start = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> end = ArgumentCaptor.forClass(Instant.class);
        verify(vendorSubOrderRepository).findSettlementCandidates(
                eq(vendorId), eq(townId), start.capture(), end.capture());
        assertThat(start.getValue()).isEqualTo(from.atStartOfDay(IST).toInstant());
        assertThat(end.getValue()).isEqualTo(to.plusDays(1).atStartOfDay(IST).toInstant());
    }

    @Test
    void resolveSubOrders_onlyReturnsWhatRepositoryAllowsAsDelivered() {
        UUID vendorId = UUID.randomUUID();
        UUID deliveredId = UUID.randomUUID();
        UUID placedId = UUID.randomUUID();

        VendorSubOrder delivered = sample(VendorSubOrderStatus.DELIVERED, "NRPT/AP-010826-0001");
        delivered.setId(deliveredId);

        // Repository contract: non-delivered IDs are excluded (JPQL status = DELIVERED).
        when(vendorSubOrderRepository.findByVendorIdAndIdIn(vendorId, List.of(deliveredId, placedId)))
                .thenReturn(List.of(delivered));

        var items = settlementCandidateService.resolveSubOrders(vendorId, List.of(deliveredId, placedId));

        assertThat(items).hasSize(1);
        assertThat(items.getFirst().getSubOrderId()).isEqualTo(deliveredId);
        assertThat(items.getFirst().getStatus()).isEqualTo(VendorSubOrderStatus.DELIVERED);
    }

    private static VendorSubOrder sample(VendorSubOrderStatus status, String orderNumber) {
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber(orderNumber)
                .placedAt(Instant.parse("2026-08-01T05:00:00Z"))
                .paymentStatus(PaymentStatus.PAID)
                .build();
        return VendorSubOrder.builder()
                .id(UUID.randomUUID())
                .order(order)
                .subOrderNumber(orderNumber + "-1/1")
                .status(status)
                .subtotal(new BigDecimal("100.00"))
                .build();
    }
}

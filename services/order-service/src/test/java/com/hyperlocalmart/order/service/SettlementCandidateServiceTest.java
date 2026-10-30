package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.beauty.BeautyOrderStatus;
import com.hyperlocalmart.order.beauty.BeautyPaymentMethod;
import com.hyperlocalmart.order.beauty.BeautyPaymentStatus;
import com.hyperlocalmart.order.entity.BeautyOrder;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.BeautyOrderRepository;
import com.hyperlocalmart.order.repository.LaundryOrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettlementCandidateServiceTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @Mock
    private VendorSubOrderRepository vendorSubOrderRepository;

    @Mock
    private LaundryOrderRepository laundryOrderRepository;

    @Mock
    private BeautyOrderRepository beautyOrderRepository;

    private final Map<UUID, BigDecimal> onlineByOrder = new HashMap<>();

    private SettlementCandidateService settlementCandidateService;

    @BeforeEach
    void wireService() {
        onlineByOrder.clear();
        settlementCandidateService = new SettlementCandidateService(
                vendorSubOrderRepository,
                laundryOrderRepository,
                beautyOrderRepository,
                orderId -> onlineByOrder.get(orderId));
    }

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
        when(laundryOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId),
                eq(from.atStartOfDay(IST).toInstant()),
                eq(to.plusDays(1).atStartOfDay(IST).toInstant())))
                .thenReturn(List.of());
        when(beautyOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId),
                eq(from.atStartOfDay(IST).toInstant()),
                eq(to.plusDays(1).atStartOfDay(IST).toInstant())))
                .thenReturn(List.of());

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
    void listCandidates_includesCompletedPartialPrepayGlamAsShopHeldFees() {
        UUID vendorId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 31);
        Instant completed = Instant.parse("2026-10-26T07:30:00Z");

        BeautyOrder glam = BeautyOrder.builder()
                .id(UUID.randomUUID())
                .orderNumber("G261026-0001")
                .townId(townId)
                .vendorId(vendorId)
                .artistName("Test")
                .buyerId(UUID.randomUUID())
                .serviceType("HAIR")
                .status(BeautyOrderStatus.COMPLETED)
                .paymentMethod(BeautyPaymentMethod.UPI)
                .paymentStatus(BeautyPaymentStatus.COLLECTED)
                .serviceAmount(new BigDecimal("700.00"))
                .travelCharge(new BigDecimal("50.00"))
                .platformFeeAmount(new BigDecimal("20.00"))
                .codFee(BigDecimal.ZERO)
                .parlourPaymentFee(new BigDecimal("11.00"))
                .prepayMode("PARTIAL")
                .placedAt(Instant.parse("2026-10-26T06:00:00Z"))
                .completedAt(completed)
                .slotStart(Instant.parse("2026-10-26T07:00:00Z"))
                .slotEnd(Instant.parse("2026-10-26T08:00:00Z"))
                .durationMinutes(60)
                .build();

        when(vendorSubOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
        when(laundryOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
        when(beautyOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(glam));
        onlineByOrder.put(glam.getId(), new BigDecimal("50.00"));

        var response = settlementCandidateService.listCandidates(vendorId, townId, from, to);

        assertThat(response.getItems()).hasSize(2);
        var online = response.getItems().stream()
                .filter(i -> i.getOrderNumber().contains("UPI"))
                .findFirst()
                .orElseThrow();
        var visit = response.getItems().stream()
                .filter(i -> "G261026-0001".equals(i.getOrderNumber()))
                .findFirst()
                .orElseThrow();
        assertThat(online.getPaymentMethod()).isEqualTo(PaymentMethod.ONLINE);
        assertThat(online.isVendorAgentDelivery()).isFalse();
        assertThat(visit.getPaymentMethod()).isEqualTo(PaymentMethod.COD);
        assertThat(visit.isVendorAgentDelivery()).isTrue();
    }

    @Test
    void listCandidates_fullOnlineGlamGoesOnKoyaKartPaysVendor() {
        UUID vendorId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 31);
        UUID orderId = UUID.randomUUID();

        BeautyOrder glam = BeautyOrder.builder()
                .id(orderId)
                .orderNumber("G261030-0001")
                .townId(townId)
                .vendorId(vendorId)
                .artistName("Test")
                .buyerId(UUID.randomUUID())
                .serviceType("HAIR")
                .status(BeautyOrderStatus.COMPLETED)
                .paymentMethod(BeautyPaymentMethod.UPI)
                .paymentStatus(BeautyPaymentStatus.COLLECTED)
                .serviceAmount(new BigDecimal("1098.00"))
                .travelCharge(BigDecimal.ZERO)
                .platformFeeAmount(new BigDecimal("2.00"))
                .codFee(BigDecimal.ZERO)
                .parlourPaymentFee(BigDecimal.ZERO)
                .amountDueTotal(new BigDecimal("1100.00"))
                .amountCollected(new BigDecimal("1100.00"))
                .prepayMode("FULL")
                .placedAt(Instant.parse("2026-10-30T06:00:00Z"))
                .completedAt(Instant.parse("2026-10-30T08:00:00Z"))
                .slotStart(Instant.parse("2026-10-30T07:00:00Z"))
                .slotEnd(Instant.parse("2026-10-30T08:00:00Z"))
                .durationMinutes(60)
                .build();

        when(vendorSubOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
        when(laundryOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
        when(beautyOrderRepository.findSettlementCandidates(
                eq(vendorId), eq(townId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(glam));
        onlineByOrder.put(orderId, new BigDecimal("1100.00"));

        var response = settlementCandidateService.listCandidates(vendorId, townId, from, to);

        assertThat(response.getItems()).hasSize(1);
        var item = response.getItems().getFirst();
        assertThat(item.getPaymentMethod()).isEqualTo(PaymentMethod.ONLINE);
        assertThat(item.isVendorAgentDelivery()).isFalse();
        assertThat(item.getSubtotal()).isEqualByComparingTo("1098.00");
        assertThat(item.getPlatformFee()).isEqualByComparingTo("0.00");
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
        when(laundryOrderRepository.findByVendorIdAndIdIn(vendorId, List.of(placedId)))
                .thenReturn(List.of());
        when(beautyOrderRepository.findByVendorIdAndIdIn(vendorId, List.of(placedId)))
                .thenReturn(List.of());

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
                .paymentMethod(PaymentMethod.COD)
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

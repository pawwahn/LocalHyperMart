package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.order.dto.response.AdminCancellationResponses.AdminCancellationRowResponse;
import com.hyperlocalmart.order.dto.response.AdminCancellationKind;
import com.hyperlocalmart.order.dto.response.AdminCancellationResponses.Initiator;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.BeautyOrderRepository;
import com.hyperlocalmart.order.repository.DiagnosticsOrderRepository;
import com.hyperlocalmart.order.repository.LaundryOrderRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminCancellationServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private BeautyOrderRepository beautyOrderRepository;
    @Mock private LaundryOrderRepository laundryOrderRepository;
    @Mock private DiagnosticsOrderRepository diagnosticsOrderRepository;
    @Mock private com.hyperlocalmart.order.client.DeliveryClient deliveryClient;
    @Mock private com.hyperlocalmart.order.client.PaymentClient paymentClient;

    @InjectMocks
    private AdminCancellationService adminCancellationService;

    @BeforeEach
    void stubPenaltyLookup() {
        when(paymentClient.findCancellationPenaltyOrderIds(any())).thenReturn(Set.of());
    }

    @Test
    void listFullCancellations_includesGroceryRow() {
        UUID townId = UUID.randomUUID();
        Instant cancelledAt = Instant.parse("2026-03-01T10:00:00Z");
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-90001")
                .townId(townId)
                .buyerId(UUID.randomUUID())
                .buyerPhoneSnapshot("9999999999")
                .status(OrderStatus.CANCELLED)
                .paymentStatus(PaymentStatus.PAID)
                .cancelledAt(cancelledAt)
                .cancelReason("Buyer cancelled order: changed mind")
                .totalAmount(new BigDecimal("200.00"))
                .vendorSubOrders(List.of())
                .build();

        when(orderRepository.findGroceryFullyCancelledByTownAndCancelledAtBetween(eq(townId), any(), any()))
                .thenReturn(List.of(order));
        when(beautyOrderRepository.findByTownIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtDesc(
                any(), any(), any(), any()))
                .thenReturn(List.of());
        when(laundryOrderRepository.findByTownIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtDesc(
                any(), any(), any(), any()))
                .thenReturn(List.of());
        when(diagnosticsOrderRepository.findByTownIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtDesc(
                any(), any(), any(), any()))
                .thenReturn(List.of());

        PageResponse<AdminCancellationRowResponse> page = adminCancellationService.listCancellations(
                UUID.randomUUID(),
                List.of("SUPER_ADMIN"),
                townId,
                AdminCancellationKind.FULL,
                null,
                null,
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 1),
                0,
                10);

        assertThat(page.getItems()).hasSize(1);
        assertThat(page.getItems().getFirst().getOrderNumber()).isEqualTo("NRPT-90001");
        assertThat(page.getItems().getFirst().getOccurredAt()).isEqualTo(cancelledAt);
    }

    @Test
    void listPartialCancellations_vendorRemovedLine_countsAsVendorLed() {
        UUID townId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        UUID vendorUserId = UUID.randomUUID();
        UUID vendorId = UUID.randomUUID();
        Instant cancelledAt = Instant.parse("2026-11-16T14:30:00Z");

        OrderItem curdRice = OrderItem.builder()
                .id(UUID.randomUUID())
                .itemNameSnapshot("Curd Rice")
                .shopNameSnapshot("Vanamadhuri Restro")
                .quantity(1)
                .unitPrice(new BigDecimal("69.00"))
                .lineTotal(new BigDecimal("69.00"))
                .status(OrderItemStatus.CANCELLED)
                .cancelReason("Out of stock")
                .cancelledAt(cancelledAt)
                .cancelledBy(vendorUserId)
                .storeCreditAmount(new BigDecimal("69.00"))
                .build();

        VendorSubOrder bag = VendorSubOrder.builder()
                .id(UUID.randomUUID())
                .vendorId(vendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("SUB-1")
                .status(VendorSubOrderStatus.DELIVERED)
                .subtotal(new BigDecimal("488.00"))
                .items(new java.util.ArrayList<>(List.of(curdRice)))
                .build();
        curdRice.setVendorSubOrder(bag);

        Order order = Order.builder()
                .id(orderId)
                .orderNumber("CLX/AP-161126-0001")
                .townId(townId)
                .buyerId(buyerId)
                .buyerPhoneSnapshot("9876543210")
                .status(OrderStatus.PLACED)
                .itemsSubtotal(new BigDecimal("488.00"))
                .platformFee(new BigDecimal("2.00"))
                .storeCreditApplied(new BigDecimal("9.00"))
                .totalAmount(new BigDecimal("481.00"))
                .vendorSubOrders(List.of(bag))
                .build();
        bag.setOrder(order);

        when(orderRepository.findGroceryPartialCancellationOrderIds(eq(townId), any(), any()))
                .thenReturn(List.of(orderId));
        when(orderRepository.findAllWithSubOrdersByIdIn(List.of(orderId))).thenReturn(List.of(order));

        PageResponse<AdminCancellationRowResponse> allPartial = adminCancellationService.listCancellations(
                UUID.randomUUID(),
                List.of("SUPER_ADMIN"),
                townId,
                AdminCancellationKind.PARTIAL,
                null,
                null,
                LocalDate.of(2026, 11, 16),
                LocalDate.of(2026, 11, 16),
                0,
                10);
        assertThat(allPartial.getItems()).hasSize(1);
        assertThat(allPartial.getItems().getFirst().getInitiatedBy()).isEqualTo(Initiator.VENDOR);
        assertThat(allPartial.getItems().getFirst().getOrderNumber()).isEqualTo("CLX/AP-161126-0001");

        PageResponse<AdminCancellationRowResponse> vendorOnly = adminCancellationService.listCancellations(
                UUID.randomUUID(),
                List.of("SUPER_ADMIN"),
                townId,
                AdminCancellationKind.PARTIAL,
                null,
                Initiator.VENDOR,
                LocalDate.of(2026, 11, 16),
                LocalDate.of(2026, 11, 16),
                0,
                10);
        assertThat(vendorOnly.getItems()).hasSize(1);
    }
}
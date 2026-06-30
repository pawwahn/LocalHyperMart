package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.service.invoice.InvoicePdfService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderInvoiceServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private TownClient townClient;
    @Mock private InvoicePdfService invoicePdfService;

    @InjectMocks
    private OrderInvoiceService orderInvoiceService;

    @Test
    void generateInvoice_returnsPdfForPlacedOrder() {
        UUID buyerId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");

        Order order = buildOrder(orderId, buyerId, townId, OrderStatus.PLACED);
        when(orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)).thenReturn(Optional.of(order));
        when(townClient.getTownSummary(townId))
                .thenReturn(new TownClient.TownSummary("NRPT", "AP", "Narsaraopet"));
        when(invoicePdfService.generate(any())).thenReturn(new byte[] {37, 80, 68, 70});

        OrderInvoiceService.InvoicePdfResult result = orderInvoiceService.generateInvoice(buyerId, orderId);

        assertThat(result.orderNumber()).isEqualTo("NRPT-00001");
        assertThat(new String(result.content(), 0, 4)).isEqualTo("%PDF");
    }

    @Test
    void generateInvoice_rejectsPaymentPendingOrder() {
        UUID buyerId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        Order order = buildOrder(orderId, buyerId, UUID.randomUUID(), OrderStatus.PAYMENT_PENDING);
        when(orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderInvoiceService.generateInvoice(buyerId, orderId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Invoice is not available");
    }

    private Order buildOrder(UUID orderId, UUID buyerId, UUID townId, OrderStatus status) {
        OrderItem item = OrderItem.builder()
                .itemNameSnapshot("Tomato")
                .shopNameSnapshot("Ravi Kirana")
                .quantity(2)
                .unitPrice(new BigDecimal("30.00"))
                .lineTotal(new BigDecimal("60.00"))
                .build();
        VendorSubOrder subOrder = VendorSubOrder.builder()
                .items(List.of(item))
                .build();
        item.setVendorSubOrder(subOrder);

        return Order.builder()
                .id(orderId)
                .orderNumber("NRPT-00001")
                .townId(townId)
                .buyerId(buyerId)
                .status(status)
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PAID)
                .itemsSubtotal(new BigDecimal("60.00"))
                .deliveryFee(new BigDecimal("40.00"))
                .totalAmount(new BigDecimal("100.00"))
                .deliveryAddressSnapshot(Map.of("line1", "MG Road"))
                .placedAt(Instant.parse("2026-06-26T10:00:00Z"))
                .vendorSubOrders(List.of(subOrder))
                .build();
    }
}

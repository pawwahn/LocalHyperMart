package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderStatusHistoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UnpaidOnlineOrderExpiryServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private OrderStatusHistoryRepository orderStatusHistoryRepository;
    @Mock private OrderMoneyUnwindService orderMoneyUnwindService;
    @Mock private NotificationClient notificationClient;
    @Mock private DeliveryClient deliveryClient;

    @InjectMocks
    private UnpaidOnlineOrderExpiryService service;

    @Test
    void expireStaleUnpaidOnlineOrders_cancelsOrderAndReleasesAssignments() {
        UUID orderId = UUID.randomUUID();
        Instant created = Instant.now().minus(2, ChronoUnit.DAYS);
        VendorSubOrder sub = VendorSubOrder.builder()
                .id(UUID.randomUUID())
                .status(VendorSubOrderStatus.DELIVERY_BY_VENDOR_AGENT)
                .build();
        Order order = Order.builder()
                .id(orderId)
                .orderNumber("CLX/AP-211026-0003")
                .townId(UUID.randomUUID())
                .buyerId(UUID.randomUUID())
                .buyerPhoneSnapshot("9876500014")
                .status(OrderStatus.PAYMENT_PENDING)
                .paymentMethod(PaymentMethod.ONLINE)
                .paymentStatus(PaymentStatus.PENDING)
                .vendorSubOrders(List.of(sub))
                .build();
        order.setCreatedAt(created);
        sub.setOrder(order);

        when(orderRepository.findIdsOfStaleUnpaidOnlineOrders(any(), any()))
                .thenReturn(List.of(orderId))
                .thenReturn(List.of());
        when(orderRepository.findWithSubOrdersById(orderId)).thenReturn(Optional.of(order));
        when(orderMoneyUnwindService.unwindCancelledOrder(eq(order), any()))
                .thenReturn(OrderMoneyUnwindService.UnwindResult.empty());

        int count = service.expireStaleUnpaidOnlineOrders();

        assertThat(count).isEqualTo(1);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(sub.getStatus()).isEqualTo(VendorSubOrderStatus.BUYER_CANCELLED);
        verify(deliveryClient).cancelActiveAssignmentsForOrder(
                orderId, UnpaidOnlineOrderExpiryService.EXPIRY_REASON);
        verify(notificationClient).notifyOrderCancelled(
                eq(order.getTownId()),
                eq(orderId),
                eq(order.getBuyerId()),
                eq(order.getBuyerPhoneSnapshot()),
                eq(order.getOrderNumber()),
                eq(UnpaidOnlineOrderExpiryService.EXPIRY_REASON));
    }
}
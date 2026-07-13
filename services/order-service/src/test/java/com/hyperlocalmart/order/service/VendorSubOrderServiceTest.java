package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.dto.request.RejectSubOrderRequest;
import com.hyperlocalmart.order.dto.response.VendorSubOrderResponse;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderStatusHistoryRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VendorSubOrderServiceTest {

    @Mock private VendorSubOrderRepository vendorSubOrderRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private OrderStatusHistoryRepository orderStatusHistoryRepository;
    @Mock private PaymentClient paymentClient;
    @Mock private NotificationClient notificationClient;

    @InjectMocks
    private VendorSubOrderService vendorSubOrderService;

    @Test
    void markReady_updatesStatusAndRecordsHistory() {
        UUID vendorId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        VendorSubOrder subOrder = placedSubOrder(vendorId, subOrderId);

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));
        when(vendorSubOrderRepository.save(subOrder)).thenReturn(subOrder);

        VendorSubOrderResponse response = vendorSubOrderService.markReady(vendorId, subOrderId, actorId);

        assertThat(response.getStatus()).isEqualTo(VendorSubOrderStatus.READY_FOR_PICKUP);
        assertThat(response.getReadyForPickupAt()).isNotNull();
        verify(orderStatusHistoryRepository).save(any());
    }

    @Test
    void reject_cancelsOrderAndInitiatesRefundForOnlinePaidOrders() {
        UUID vendorId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        VendorSubOrder subOrder = placedSubOrder(vendorId, subOrderId);
        Order order = subOrder.getOrder();
        order.setBuyerId(buyerId);
        order.setStatus(OrderStatus.PLACED);
        order.setPaymentMethod(PaymentMethod.ONLINE);
        order.setPaymentStatus(PaymentStatus.PAID);
        order.setTotalAmount(new BigDecimal("850.00"));

        RejectSubOrderRequest request = new RejectSubOrderRequest();
        request.setReason("Out of stock today");

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));
        when(orderRepository.save(order)).thenReturn(order);

        VendorSubOrderResponse response = vendorSubOrderService.reject(vendorId, subOrderId, actorId, request);

        assertThat(response.getStatus()).isEqualTo(VendorSubOrderStatus.VENDOR_REJECTED);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(paymentClient).initiateRefund(eq(order.getId()), eq(buyerId), eq(new BigDecimal("850.00")), eq("Out of stock today"));

        ArgumentCaptor<OrderStatusHistory> historyCaptor = ArgumentCaptor.forClass(OrderStatusHistory.class);
        verify(orderStatusHistoryRepository, times(2)).save(historyCaptor.capture());
        assertThat(historyCaptor.getAllValues().get(1).getFromStatus()).isEqualTo("PLACED");
        assertThat(historyCaptor.getAllValues().get(1).getToStatus()).isEqualTo("CANCELLED");
    }

    private VendorSubOrder placedSubOrder(UUID vendorId, UUID subOrderId) {
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00001")
                .townId(UUID.randomUUID())
                .buyerId(UUID.randomUUID())
                .status(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PENDING)
                .itemsSubtotal(new BigDecimal("500.00"))
                .deliveryFee(new BigDecimal("38.00"))
                .totalAmount(new BigDecimal("538.00"))
                .deliveryAddressSnapshot(java.util.Map.of("line1", "MG Road"))
                .vendorSubOrders(new ArrayList<>())
                .build();

        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(subOrderId)
                .order(order)
                .vendorId(vendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00001-1/1")
                .status(VendorSubOrderStatus.PLACED)
                .subtotal(new BigDecimal("500.00"))
                .items(new ArrayList<>(List.of(OrderItem.builder()
                        .itemNameSnapshot("Tomato")
                        .shopNameSnapshot("Ravi Kirana")
                        .quantity(2)
                        .lineTotal(new BigDecimal("500.00"))
                        .build())))
                .build();
        order.getVendorSubOrders().add(subOrder);
        return subOrder;
    }
}

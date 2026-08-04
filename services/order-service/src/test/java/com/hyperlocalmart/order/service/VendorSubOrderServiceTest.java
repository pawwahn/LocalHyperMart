package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.dto.request.CancelOrderItemRequest;
import com.hyperlocalmart.order.dto.request.RejectSubOrderRequest;
import com.hyperlocalmart.order.dto.response.VendorSubOrderResponse;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderItemRepository;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VendorSubOrderServiceTest {

    @Mock private VendorSubOrderRepository vendorSubOrderRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private OrderStatusHistoryRepository orderStatusHistoryRepository;
    @Mock private PaymentClient paymentClient;
    @Mock private NotificationClient notificationClient;
    @Mock private com.hyperlocalmart.order.client.DeliveryClient deliveryClient;
    @Mock private OrderMoneyUnwindService orderMoneyUnwindService;

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
    void reject_lastShop_cancelsOrderAndUnwindsMoney() {
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
        subOrder.getItems().get(0).setId(UUID.randomUUID());
        subOrder.getItems().get(0).setStatus(OrderItemStatus.ACTIVE);

        RejectSubOrderRequest request = new RejectSubOrderRequest();
        request.setReason("Out of stock today");

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));
        when(orderRepository.save(order)).thenReturn(order);
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(vendorSubOrderRepository.save(subOrder)).thenReturn(subOrder);
        when(vendorSubOrderRepository.saveAndFlush(subOrder)).thenReturn(subOrder);
        when(orderItemRepository.sumActiveLineTotalsForSubOrder(subOrderId)).thenReturn(BigDecimal.ZERO);
        when(orderItemRepository.sumActiveLineTotalsForOrder(order.getId())).thenReturn(BigDecimal.ZERO);
        when(deliveryClient.listHubContactsForTown(order.getTownId())).thenReturn(List.of());
        when(orderMoneyUnwindService.unwindCancelledOrder(eq(order), eq("Out of stock today")))
                .thenAnswer(invocation -> {
                    Order o = invocation.getArgument(0);
                    o.setPaymentStatus(PaymentStatus.REFUNDED);
                    return new OrderMoneyUnwindService.UnwindResult(
                            true, new BigDecimal("850.00"), false, BigDecimal.ZERO);
                });

        VendorSubOrderResponse response = vendorSubOrderService.reject(vendorId, subOrderId, actorId, request);

        assertThat(response.getStatus()).isEqualTo(VendorSubOrderStatus.VENDOR_REJECTED);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(orderMoneyUnwindService).unwindCancelledOrder(eq(order), eq("Out of stock today"));
        verify(paymentClient, never()).creditWallet(any(), any(), any(), any(), any(), any(), any());

        ArgumentCaptor<OrderStatusHistory> historyCaptor = ArgumentCaptor.forClass(OrderStatusHistory.class);
        verify(orderStatusHistoryRepository, times(2)).save(historyCaptor.capture());
        assertThat(historyCaptor.getAllValues().get(1).getFromStatus()).isEqualTo("PLACED");
        assertThat(historyCaptor.getAllValues().get(1).getToStatus()).isEqualTo("CANCELLED");
    }

    @Test
    void reject_keepsSiblingReadyAndCreditsWalletForThisShopOnly() {
        UUID vendorId = UUID.randomUUID();
        UUID siblingVendorId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00011")
                .townId(UUID.randomUUID())
                .buyerId(buyerId)
                .buyerPhoneSnapshot("9876500111")
                .status(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.ONLINE)
                .paymentStatus(PaymentStatus.PAID)
                .itemsSubtotal(new BigDecimal("800.00"))
                .deliveryFee(new BigDecimal("38.00"))
                .storeCreditApplied(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("838.00"))
                .deliveryAddressSnapshot(java.util.Map.of("line1", "MG Road"))
                .vendorSubOrders(new ArrayList<>())
                .build();

        OrderItem rejectItem = OrderItem.builder()
                .id(itemId)
                .itemNameSnapshot("Tomato")
                .shopNameSnapshot("Ravi Kirana")
                .quantity(2)
                .lineTotal(new BigDecimal("300.00"))
                .status(OrderItemStatus.ACTIVE)
                .build();

        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(subOrderId)
                .order(order)
                .vendorId(vendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00011-2/2")
                .status(VendorSubOrderStatus.PLACED)
                .subtotal(new BigDecimal("300.00"))
                .items(new ArrayList<>(List.of(rejectItem)))
                .build();
        rejectItem.setVendorSubOrder(subOrder);

        VendorSubOrder sibling = VendorSubOrder.builder()
                .id(UUID.randomUUID())
                .order(order)
                .vendorId(siblingVendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00011-1/2")
                .status(VendorSubOrderStatus.READY_FOR_PICKUP)
                .subtotal(new BigDecimal("500.00"))
                .items(new ArrayList<>(List.of(OrderItem.builder()
                        .id(UUID.randomUUID())
                        .itemNameSnapshot("Onion")
                        .shopNameSnapshot("Fresh Mart")
                        .quantity(1)
                        .lineTotal(new BigDecimal("500.00"))
                        .status(OrderItemStatus.ACTIVE)
                        .build())))
                .build();

        order.getVendorSubOrders().add(sibling);
        order.getVendorSubOrders().add(subOrder);

        RejectSubOrderRequest request = new RejectSubOrderRequest();
        request.setReason("Can't fulfill today");

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));
        when(orderRepository.save(order)).thenReturn(order);
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(vendorSubOrderRepository.save(subOrder)).thenReturn(subOrder);
        when(vendorSubOrderRepository.saveAndFlush(subOrder)).thenReturn(subOrder);
        when(orderItemRepository.sumActiveLineTotalsForOrder(order.getId()))
                .thenReturn(new BigDecimal("500.00"));
        when(deliveryClient.listHubContactsForTown(order.getTownId())).thenReturn(List.of());
        when(paymentClient.creditWallet(eq(buyerId), eq(new BigDecimal("300.00")), eq("ORDER_ITEM_CANCEL"),
                eq(subOrderId), eq(order.getId()), eq(itemId), any()))
                .thenReturn(new BigDecimal("300.00"));

        VendorSubOrderResponse response = vendorSubOrderService.reject(vendorId, subOrderId, actorId, request);

        assertThat(response.getStatus()).isEqualTo(VendorSubOrderStatus.VENDOR_REJECTED);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PLACED);
        assertThat(sibling.getStatus()).isEqualTo(VendorSubOrderStatus.READY_FOR_PICKUP);
        assertThat(rejectItem.getStatus()).isEqualTo(OrderItemStatus.CANCELLED);
        verify(orderMoneyUnwindService, never()).unwindCancelledOrder(any(), any());
        verify(orderMoneyUnwindService, never()).unwindCancelledOrder(any(), any(), any());
        verify(notificationClient).notifyItemCancelledStoreCredit(
                eq(order.getTownId()), eq(order.getId()), eq(buyerId), eq("9876500111"),
                eq("NRPT-00011"), eq("Ravi Kirana items"), eq(new BigDecimal("300.00")), eq(new BigDecimal("300.00")));
    }

    @Test
    void reject_codSibling_creditsWalletAndReducesCashDue() {
        UUID vendorId = UUID.randomUUID();
        UUID siblingVendorId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();
        UUID hubUserId = UUID.randomUUID();

        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00012")
                .townId(townId)
                .buyerId(buyerId)
                .buyerPhoneSnapshot("9876500112")
                .status(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PAID)
                .itemsSubtotal(new BigDecimal("800.00"))
                .deliveryFee(new BigDecimal("38.00"))
                .storeCreditApplied(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("838.00"))
                .deliveryAddressSnapshot(java.util.Map.of("line1", "MG Road"))
                .vendorSubOrders(new ArrayList<>())
                .build();

        OrderItem rejectItem = OrderItem.builder()
                .id(itemId)
                .itemNameSnapshot("Tomato")
                .shopNameSnapshot("Ravi Kirana")
                .quantity(2)
                .lineTotal(new BigDecimal("300.00"))
                .status(OrderItemStatus.ACTIVE)
                .build();

        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(subOrderId)
                .order(order)
                .vendorId(vendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00012-2/2")
                .status(VendorSubOrderStatus.PLACED)
                .subtotal(new BigDecimal("300.00"))
                .items(new ArrayList<>(List.of(rejectItem)))
                .build();
        rejectItem.setVendorSubOrder(subOrder);

        VendorSubOrder sibling = VendorSubOrder.builder()
                .id(UUID.randomUUID())
                .order(order)
                .vendorId(siblingVendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00012-1/2")
                .status(VendorSubOrderStatus.READY_FOR_PICKUP)
                .subtotal(new BigDecimal("500.00"))
                .items(new ArrayList<>(List.of(OrderItem.builder()
                        .id(UUID.randomUUID())
                        .itemNameSnapshot("Onion")
                        .shopNameSnapshot("Fresh Mart")
                        .quantity(1)
                        .lineTotal(new BigDecimal("500.00"))
                        .status(OrderItemStatus.ACTIVE)
                        .build())))
                .build();

        order.getVendorSubOrders().add(sibling);
        order.getVendorSubOrders().add(subOrder);

        RejectSubOrderRequest request = new RejectSubOrderRequest();
        request.setReason("Can't fulfill today");

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));
        when(orderRepository.save(order)).thenReturn(order);
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(vendorSubOrderRepository.save(subOrder)).thenReturn(subOrder);
        when(vendorSubOrderRepository.saveAndFlush(subOrder)).thenReturn(subOrder);
        when(orderItemRepository.sumActiveLineTotalsForOrder(order.getId()))
                .thenReturn(new BigDecimal("500.00"));
        when(paymentClient.creditWallet(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new BigDecimal("300.00"));
        when(deliveryClient.listHubContactsForTown(townId)).thenReturn(List.of(
                new com.hyperlocalmart.order.client.DeliveryClient.HubContact(
                        hubUserId, UUID.randomUUID(), "Narsaraopet Hub", "9876500100")));

        VendorSubOrderResponse response = vendorSubOrderService.reject(vendorId, subOrderId, actorId, request);

        assertThat(response.getStatus()).isEqualTo(VendorSubOrderStatus.VENDOR_REJECTED);
        assertThat(rejectItem.getStoreCreditAmount()).isEqualByComparingTo("300.00");
        verify(paymentClient).creditWallet(
                eq(buyerId),
                eq(new BigDecimal("300.00")),
                eq("ORDER_ITEM_CANCEL"),
                eq(subOrderId),
                eq(order.getId()),
                eq(itemId),
                any());
        verify(notificationClient).notifyItemCancelledStoreCredit(
                eq(townId), eq(order.getId()), eq(buyerId), eq("9876500112"),
                eq("NRPT-00012"), eq("Ravi Kirana items"), eq(new BigDecimal("300.00")),
                eq(new BigDecimal("300.00")));
        verify(notificationClient).notifyVendorShopRejected(
                eq(townId), eq(hubUserId), eq("9876500100"), eq(order.getId()),
                eq("NRPT-00012"), eq("Ravi Kirana"), eq(new BigDecimal("300.00")),
                eq("Can't fulfill today"), eq("9876500112"));
    }

    @Test
    void cancelItem_creditsWalletAndKeepsSiblingSubOrder() {
        UUID vendorId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID otherItemId = UUID.randomUUID();

        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00010")
                .townId(UUID.randomUUID())
                .buyerId(buyerId)
                .buyerPhoneSnapshot("9876500999")
                .status(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.ONLINE)
                .paymentStatus(PaymentStatus.PAID)
                .itemsSubtotal(new BigDecimal("800.00"))
                .deliveryFee(new BigDecimal("38.00"))
                .storeCreditApplied(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("838.00"))
                .deliveryAddressSnapshot(java.util.Map.of("line1", "MG Road"))
                .vendorSubOrders(new ArrayList<>())
                .build();

        OrderItem cancelTarget = OrderItem.builder()
                .id(itemId)
                .itemNameSnapshot("Tomato")
                .shopNameSnapshot("Ravi Kirana")
                .quantity(2)
                .lineTotal(new BigDecimal("300.00"))
                .status(OrderItemStatus.ACTIVE)
                .build();
        OrderItem keepItem = OrderItem.builder()
                .id(otherItemId)
                .itemNameSnapshot("Onion")
                .shopNameSnapshot("Ravi Kirana")
                .quantity(1)
                .lineTotal(new BigDecimal("200.00"))
                .status(OrderItemStatus.ACTIVE)
                .build();

        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(subOrderId)
                .order(order)
                .vendorId(vendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00010-1/2")
                .status(VendorSubOrderStatus.PLACED)
                .subtotal(new BigDecimal("500.00"))
                .items(new ArrayList<>(List.of(cancelTarget, keepItem)))
                .build();
        cancelTarget.setVendorSubOrder(subOrder);
        keepItem.setVendorSubOrder(subOrder);

        VendorSubOrder sibling = VendorSubOrder.builder()
                .id(UUID.randomUUID())
                .order(order)
                .vendorId(UUID.randomUUID())
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00010-2/2")
                .status(VendorSubOrderStatus.PLACED)
                .subtotal(new BigDecimal("300.00"))
                .items(new ArrayList<>(List.of(OrderItem.builder()
                        .id(UUID.randomUUID())
                        .itemNameSnapshot("Milk")
                        .shopNameSnapshot("Dairy")
                        .quantity(1)
                        .lineTotal(new BigDecimal("300.00"))
                        .status(OrderItemStatus.ACTIVE)
                        .build())))
                .build();

        order.getVendorSubOrders().add(subOrder);
        order.getVendorSubOrders().add(sibling);

        CancelOrderItemRequest request = new CancelOrderItemRequest();
        request.setReason("Out of stock");

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));
        when(orderRepository.save(order)).thenReturn(order);
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(vendorSubOrderRepository.save(subOrder)).thenReturn(subOrder);
        when(vendorSubOrderRepository.saveAndFlush(subOrder)).thenReturn(subOrder);
        when(orderItemRepository.sumActiveLineTotalsForSubOrder(subOrderId))
                .thenReturn(new BigDecimal("200.00"));
        when(orderItemRepository.sumActiveLineTotalsForOrder(order.getId()))
                .thenReturn(new BigDecimal("500.00"));
        when(paymentClient.creditWallet(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new BigDecimal("300.00"));

        VendorSubOrderResponse response = vendorSubOrderService.cancelItem(
                vendorId, subOrderId, itemId, actorId, request);

        assertThat(cancelTarget.getStatus()).isEqualTo(OrderItemStatus.CANCELLED);
        assertThat(subOrder.getStatus()).isEqualTo(VendorSubOrderStatus.PLACED);
        assertThat(subOrder.getSubtotal()).isEqualByComparingTo("200.00");
        assertThat(sibling.getStatus()).isEqualTo(VendorSubOrderStatus.PLACED);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PLACED);
        assertThat(order.getItemsSubtotal()).isEqualByComparingTo("500.00");
        assertThat(order.getTotalAmount()).isEqualByComparingTo("538.00");
        assertThat(response.getItems()).hasSize(2);

        verify(paymentClient).creditWallet(
                eq(buyerId),
                eq(new BigDecimal("300.00")),
                eq("ORDER_ITEM_CANCEL"),
                eq(itemId),
                eq(order.getId()),
                eq(itemId),
                any());
        verify(notificationClient).notifyItemCancelledStoreCredit(
                eq(order.getTownId()),
                eq(order.getId()),
                eq(buyerId),
                eq("9876500999"),
                eq("NRPT-00010"),
                eq("Tomato"),
                eq(new BigDecimal("300.00")),
                eq(new BigDecimal("300.00")));
        verify(paymentClient, never()).initiateRefund(any(), any(), any(), any());
    }

    @Test
    void restoreItem_debitsWalletWhenCreditStillAvailable() {
        UUID vendorId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID keepId = UUID.randomUUID();

        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00020")
                .townId(UUID.randomUUID())
                .buyerId(buyerId)
                .buyerPhoneSnapshot("9876500999")
                .status(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PENDING)
                .itemsSubtotal(new BigDecimal("100.00"))
                .deliveryFee(new BigDecimal("38.00"))
                .storeCreditApplied(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("138.00"))
                .deliveryAddressSnapshot(java.util.Map.of("line1", "MG Road"))
                .vendorSubOrders(new ArrayList<>())
                .build();

        OrderItem cancelled = OrderItem.builder()
                .id(itemId)
                .itemNameSnapshot("Banana Chips")
                .shopNameSnapshot("Ravi Kirana")
                .quantity(1)
                .lineTotal(new BigDecimal("60.00"))
                .status(OrderItemStatus.CANCELLED)
                .storeCreditAmount(new BigDecimal("60.00"))
                .build();
        OrderItem keep = OrderItem.builder()
                .id(keepId)
                .itemNameSnapshot("Milk")
                .shopNameSnapshot("Ravi Kirana")
                .quantity(1)
                .lineTotal(new BigDecimal("100.00"))
                .status(OrderItemStatus.ACTIVE)
                .build();

        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(subOrderId)
                .order(order)
                .vendorId(vendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00020-1/1")
                .status(VendorSubOrderStatus.READY_FOR_PICKUP)
                .readyForPickupAt(java.time.Instant.now())
                .subtotal(new BigDecimal("100.00"))
                .items(new ArrayList<>(List.of(cancelled, keep)))
                .build();
        cancelled.setVendorSubOrder(subOrder);
        keep.setVendorSubOrder(subOrder);
        order.getVendorSubOrders().add(subOrder);

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));
        when(orderRepository.save(order)).thenReturn(order);
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(vendorSubOrderRepository.save(subOrder)).thenReturn(subOrder);
        when(vendorSubOrderRepository.saveAndFlush(subOrder)).thenReturn(subOrder);
        when(orderItemRepository.sumActiveLineTotalsForSubOrder(subOrderId))
                .thenReturn(new BigDecimal("160.00"));
        when(orderItemRepository.sumActiveLineTotalsForOrder(order.getId()))
                .thenReturn(new BigDecimal("160.00"));
        when(paymentClient.getWalletBalance(buyerId)).thenReturn(new BigDecimal("60.00"));
        when(paymentClient.debitWallet(any(), any(), any(), any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);

        VendorSubOrderResponse response = vendorSubOrderService.restoreItem(
                vendorId, subOrderId, itemId, actorId);

        assertThat(cancelled.getStatus()).isEqualTo(OrderItemStatus.ACTIVE);
        assertThat(subOrder.getSubtotal()).isEqualByComparingTo("160.00");
        assertThat(order.getItemsSubtotal()).isEqualByComparingTo("160.00");
        assertThat(response.getStatus()).isEqualTo(VendorSubOrderStatus.READY_FOR_PICKUP);
        verify(paymentClient).debitWallet(
                eq(buyerId),
                eq(new BigDecimal("60.00")),
                eq("ORDER_ITEM_RESTORE"),
                any(UUID.class),
                eq(order.getId()),
                any());
        verify(notificationClient).notifyItemRestored(
                eq(order.getTownId()),
                eq(order.getId()),
                eq(buyerId),
                eq("9876500999"),
                eq("NRPT-00020"),
                eq("Banana Chips"),
                eq(new BigDecimal("60.00")));
    }

    @Test
    void restoreItem_blocksWhenWalletCreditAlreadyUsed() {
        UUID vendorId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00021")
                .townId(UUID.randomUUID())
                .buyerId(buyerId)
                .status(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PENDING)
                .itemsSubtotal(BigDecimal.ZERO)
                .deliveryFee(new BigDecimal("38.00"))
                .storeCreditApplied(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("38.00"))
                .deliveryAddressSnapshot(java.util.Map.of("line1", "MG Road"))
                .vendorSubOrders(new ArrayList<>())
                .build();

        OrderItem cancelled = OrderItem.builder()
                .id(itemId)
                .itemNameSnapshot("Banana Chips")
                .quantity(1)
                .lineTotal(new BigDecimal("60.00"))
                .status(OrderItemStatus.CANCELLED)
                .storeCreditAmount(new BigDecimal("60.00"))
                .build();

        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(subOrderId)
                .order(order)
                .vendorId(vendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00021-1/1")
                .status(VendorSubOrderStatus.READY_FOR_PICKUP)
                .subtotal(BigDecimal.ZERO)
                .items(new ArrayList<>(List.of(cancelled)))
                .build();
        cancelled.setVendorSubOrder(subOrder);
        order.getVendorSubOrders().add(subOrder);

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));
        when(paymentClient.getWalletBalance(buyerId)).thenReturn(new BigDecimal("10.00"));

        assertThatThrownBy(() -> vendorSubOrderService.restoreItem(vendorId, subOrderId, itemId, actorId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already used this store credit");
        verify(paymentClient, never()).debitWallet(any(), any(), any(), any(), any(), any());
        assertThat(cancelled.getStatus()).isEqualTo(OrderItemStatus.CANCELLED);
    }

    @Test
    void restoreItem_blocksBuyerCancelledItem() {
        UUID vendorId = UUID.randomUUID();
        UUID subOrderId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00022")
                .townId(UUID.randomUUID())
                .buyerId(buyerId)
                .status(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PENDING)
                .itemsSubtotal(BigDecimal.ZERO)
                .deliveryFee(new BigDecimal("38.00"))
                .storeCreditApplied(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("38.00"))
                .deliveryAddressSnapshot(java.util.Map.of("line1", "MG Road"))
                .vendorSubOrders(new ArrayList<>())
                .build();

        OrderItem cancelled = OrderItem.builder()
                .id(itemId)
                .itemNameSnapshot("Banana Chips")
                .shopNameSnapshot("Ravi Kirana")
                .quantity(1)
                .lineTotal(new BigDecimal("60.00"))
                .status(OrderItemStatus.CANCELLED)
                .cancelledBy(buyerId)
                .storeCreditAmount(new BigDecimal("60.00"))
                .build();

        VendorSubOrder subOrder = VendorSubOrder.builder()
                .id(subOrderId)
                .order(order)
                .vendorId(vendorId)
                .shopId(UUID.randomUUID())
                .subOrderNumber("NRPT-00022-1/1")
                .status(VendorSubOrderStatus.PLACED)
                .subtotal(BigDecimal.ZERO)
                .items(new ArrayList<>(List.of(cancelled)))
                .build();
        cancelled.setVendorSubOrder(subOrder);
        order.getVendorSubOrders().add(subOrder);

        when(vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId))
                .thenReturn(Optional.of(subOrder));

        assertThatThrownBy(() -> vendorSubOrderService.restoreItem(vendorId, subOrderId, itemId, actorId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Buyer cancelled");
        verify(paymentClient, never()).debitWallet(any(), any(), any(), any(), any(), any());
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

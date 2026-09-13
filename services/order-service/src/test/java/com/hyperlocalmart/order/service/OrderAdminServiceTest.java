package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.VendorOrderAlertRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderAdminServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private DeliveryClient deliveryClient;
    @Mock private VendorOrderAlertRepository vendorOrderAlertRepository;

    @InjectMocks
    private OrderAdminService orderAdminService;

    @Test
    void listAdminOrders_returnsTownOrdersForHubAdmin() {
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");
        UUID hubAdminUserId = UUID.fromString("00000000-0000-4000-8000-000000000201");
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("NRPT-00001")
                .townId(townId)
                .buyerId(UUID.randomUUID())
                .status(OrderStatus.PLACED)
                .paymentStatus(PaymentStatus.PAID)
                .totalAmount(new BigDecimal("538.00"))
                .vendorSubOrders(List.of())
                .build();

        when(deliveryClient.getHubAdminContext(hubAdminUserId))
                .thenReturn(new DeliveryClient.HubAdminContext(hubAdminUserId, UUID.randomUUID(), townId));
        when(orderRepository.findByTownIdOrderByCreatedAtDesc(eq(townId), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(order)));

        var result = orderAdminService.listAdminOrders(
                hubAdminUserId, List.of("HUB_ADMIN"), townId, null, null, null, 0, 20);

        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getItems().getFirst().getOrderNumber()).isEqualTo("NRPT-00001");
    }

    @Test
    void getAdminOrder_countsActiveItemsAndKeepsCancelledVisible() {
        UUID townId = UUID.fromString("a8e7366c-2bd8-4376-b18b-7ba110f4d69f");
        UUID hubAdminUserId = UUID.fromString("00000000-0000-4000-8000-000000000202");
        UUID orderId = UUID.randomUUID();

        OrderItem active = OrderItem.builder()
                .id(UUID.randomUUID())
                .itemNameSnapshot("Toor Dal")
                .shopNameSnapshot("R K Fancy")
                .quantity(1)
                .lineTotal(new BigDecimal("160.00"))
                .status(OrderItemStatus.ACTIVE)
                .build();
        OrderItem cancelled = OrderItem.builder()
                .id(UUID.randomUUID())
                .itemNameSnapshot("Biryani Masala")
                .shopNameSnapshot("R K Fancy")
                .quantity(1)
                .lineTotal(new BigDecimal("50.00"))
                .status(OrderItemStatus.CANCELLED)
                .build();
        VendorSubOrder bag = VendorSubOrder.builder()
                .id(UUID.randomUUID())
                .subOrderNumber("CLX/AP-110926-0001/1")
                .vendorId(UUID.randomUUID())
                .shopId(UUID.randomUUID())
                .status(VendorSubOrderStatus.READY_FOR_PICKUP)
                .subtotal(new BigDecimal("160.00"))
                .items(List.of(active, cancelled))
                .build();
        Order order = Order.builder()
                .id(orderId)
                .orderNumber("CLX/AP-110926-0001")
                .townId(townId)
                .buyerId(UUID.randomUUID())
                .status(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PENDING)
                .totalAmount(new BigDecimal("161.00"))
                .vendorSubOrders(List.of(bag))
                .build();
        bag.setOrder(order);

        when(deliveryClient.getHubAdminContext(hubAdminUserId))
                .thenReturn(new DeliveryClient.HubAdminContext(hubAdminUserId, UUID.randomUUID(), townId));
        when(orderRepository.findAdminDetailById(orderId)).thenReturn(java.util.Optional.of(order));
        when(vendorOrderAlertRepository.findByVendorSubOrderIdInOrderByCreatedAtDesc(any()))
                .thenReturn(List.of());
        when(deliveryClient.getAssignmentsForOrder(orderId)).thenReturn(List.of());

        var detail = orderAdminService.getAdminOrder(
                hubAdminUserId, List.of("HUB_ADMIN"), orderId, townId);

        assertThat(detail.getSubOrders()).hasSize(1);
        var sub = detail.getSubOrders().getFirst();
        assertThat(sub.getItemCount()).isEqualTo(1);
        assertThat(sub.getCancelledItemCount()).isEqualTo(1);
        assertThat(sub.getItems()).hasSize(2);
        assertThat(sub.getItems().get(1).getStatus()).isEqualTo("CANCELLED");
    }
}

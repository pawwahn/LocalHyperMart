package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderRepository;
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
}

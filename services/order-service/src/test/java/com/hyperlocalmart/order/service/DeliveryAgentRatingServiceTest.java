package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.repository.DeliveryAgentRatingRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryAgentRatingServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private DeliveryAgentRatingRepository deliveryAgentRatingRepository;

    @Test
    void lastMile_picksLatestLastMileAgent() {
        UUID older = UUID.randomUUID();
        UUID newer = UUID.randomUUID();
        Instant t1 = Instant.parse("2026-09-28T10:00:00Z");
        Instant t2 = Instant.parse("2026-09-28T12:00:00Z");
        var pickup = assignment(older, "PICKUP", t2);
        var first = assignment(older, "LAST_MILE", t1);
        var last = assignment(newer, "LAST_MILE", t2);

        var picked = DeliveryAgentRatingService.lastMileAssignment(List.of(pickup, first, last));

        assertThat(picked).isNotNull();
        assertThat(picked.agentId()).isEqualTo(newer);
    }

    @Test
    void rate_rejectsBeforeDelivery() {
        UUID buyerId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        Order order = new Order();
        order.setId(orderId);
        order.setStatus(OrderStatus.PLACED);
        when(orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)).thenReturn(Optional.of(order));

        DeliveryAgentRatingService service = new DeliveryAgentRatingService(
                orderRepository, deliveryAgentRatingRepository, null, null);
        var req = new com.hyperlocalmart.order.dto.request.RateDeliveryAgentRequest();
        req.setStars(5);

        assertThatThrownBy(() -> service.rate(buyerId, orderId, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("after delivery");
    }

    private static DeliveryClient.OrderAssignment assignment(UUID agentId, String leg, Instant when) {
        return new DeliveryClient.OrderAssignment(
                UUID.randomUUID(), "A-1", "CLX/AP-1", null, agentId, "Raju", "9876500200",
                leg, "COMPLETED", when, when, when, List.of());
    }
}

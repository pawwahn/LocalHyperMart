package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HubOrderStatsServiceTest {

    @Mock private VendorSubOrderRepository vendorSubOrderRepository;
    @Mock private OrderRepository orderRepository;

    @InjectMocks
    private HubOrderStatsService hubOrderStatsService;

    @Test
    void getHubOrderStats_returnsTownCounts() {
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");
        when(vendorSubOrderRepository.countReadyForPickupByTownId(townId)).thenReturn(4L);
        when(orderRepository.countByTownIdAndStatus(townId, OrderStatus.PLACED)).thenReturn(6L);

        var stats = hubOrderStatsService.getHubOrderStats(townId);

        assertThat(stats.getReadyForPickupCount()).isEqualTo(4);
        assertThat(stats.getPlacedOrdersCount()).isEqualTo(6);
    }
}

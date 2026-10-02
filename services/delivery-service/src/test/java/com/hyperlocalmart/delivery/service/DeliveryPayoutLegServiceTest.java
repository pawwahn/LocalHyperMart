package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.AssignmentStatus;
import com.hyperlocalmart.delivery.entity.DeliveryAssignment;
import com.hyperlocalmart.delivery.entity.DeliveryHub;
import com.hyperlocalmart.delivery.repository.DeliveryAssignmentRepository;
import com.hyperlocalmart.delivery.repository.DeliveryHubRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryPayoutLegServiceTest {

    @Mock private DeliveryAssignmentRepository deliveryAssignmentRepository;
    @Mock private DeliveryHubRepository deliveryHubRepository;

    @InjectMocks private DeliveryPayoutLegService service;

    @Test
    void resolve_vendorDirectCompleted_mapsAgentAndTownHub() {
        UUID orderId = UUID.randomUUID();
        UUID townId = UUID.randomUUID();
        UUID hubId = UUID.randomUUID();
        UUID agentId = UUID.randomUUID();
        Instant done = Instant.parse("2026-09-01T10:00:00Z");

        DeliveryAssignment vendorTrip = DeliveryAssignment.builder()
                .orderId(orderId)
                .townId(townId)
                .agentId(agentId)
                .legType(AssignmentLegType.VENDOR_DIRECT)
                .status(AssignmentStatus.COMPLETED)
                .completedAt(done)
                .build();

        when(deliveryAssignmentRepository.findByOrderIdInAndLegTypeAndStatus(
                        eq(List.of(orderId)), eq(AssignmentLegType.VENDOR_DIRECT), eq(AssignmentStatus.COMPLETED)))
                .thenReturn(List.of(vendorTrip));
        when(deliveryAssignmentRepository.findByOrderIdInAndLegTypeAndStatus(
                        eq(List.of(orderId)), eq(AssignmentLegType.LAST_MILE), eq(AssignmentStatus.COMPLETED)))
                .thenReturn(List.of());
        when(deliveryAssignmentRepository.findByOrderIdInAndLegTypeAndStatus(
                        eq(List.of(orderId)), eq(AssignmentLegType.PICKUP), eq(AssignmentStatus.COMPLETED)))
                .thenReturn(List.of());
        when(deliveryHubRepository.findByTownId(townId))
                .thenReturn(Optional.of(DeliveryHub.builder().id(hubId).townId(townId).name("Town Hub").build()));

        DeliveryPayoutLegService.OrderLegs legs = service.resolve(List.of(orderId)).get(0);

        assertThat(legs.vendorDirectCompleted()).isTrue();
        assertThat(legs.agentId()).isEqualTo(agentId);
        assertThat(legs.hubId()).isEqualTo(hubId);
        assertThat(legs.lastMileCompleted()).isFalse();
        assertThat(legs.pickupCompleted()).isFalse();
    }
}

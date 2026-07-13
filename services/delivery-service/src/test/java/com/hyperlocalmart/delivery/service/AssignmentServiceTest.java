package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.delivery.client.NotificationClient;
import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.dto.request.AssignPickupRequest;
import com.hyperlocalmart.delivery.dto.response.AssignmentResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignmentServiceTest {

    @Mock private HubAdminRepository hubAdminRepository;
    @Mock private DeliveryHubRepository deliveryHubRepository;
    @Mock private DeliveryAgentRepository deliveryAgentRepository;
    @Mock private AgentHubLinkRepository agentHubLinkRepository;
    @Mock private DeliveryAssignmentRepository deliveryAssignmentRepository;
    @Mock private DeliveryEventRepository deliveryEventRepository;
    @Mock private OrderClient orderClient;
    @Mock private DeliveryOtpService deliveryOtpService;
    @Mock private NotificationClient notificationClient;

    @InjectMocks
    private AssignmentService assignmentService;

    @Test
    void assignPickup_createsAssignedPickupAssignment() {
        UUID hubAdminUserId = UUID.fromString("00000000-0000-4000-8000-000000000201");
        UUID hubId = UUID.fromString("d1111111-1111-4111-8111-111111111111");
        UUID agentId = UUID.fromString("e1111111-1111-4111-8111-111111111111");
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");
        UUID subOrderId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();

        AssignPickupRequest request = new AssignPickupRequest();
        request.setVendorSubOrderId(subOrderId);
        request.setAgentId(agentId);

        when(hubAdminRepository.findByUserIdAndStatus(hubAdminUserId, "ACTIVE"))
                .thenReturn(Optional.of(HubAdmin.builder().hubId(hubId).userId(hubAdminUserId).status("ACTIVE").build()));
        when(deliveryAgentRepository.findById(agentId))
                .thenReturn(Optional.of(DeliveryAgent.builder()
                        .id(agentId)
                        .userId(UUID.randomUUID())
                        .name("Raju Delivery")
                        .phone("9876500200")
                        .status(AgentStatus.ACTIVE)
                        .build()));
        when(agentHubLinkRepository.existsByAgentIdAndHubIdAndActiveTrue(agentId, hubId)).thenReturn(true);
        when(orderClient.getSubOrder(subOrderId)).thenReturn(new OrderClient.SubOrderSnapshot(
                subOrderId, orderId, townId, UUID.randomUUID(), "READY_FOR_PICKUP",
                "NRPT/AP-260708-O0001", "NRPT/AP-260708-O0001-1/2"
        ));
        when(deliveryAssignmentRepository.existsByVendorSubOrderIdAndLegTypeAndStatusIn(
                subOrderId, AssignmentLegType.PICKUP,
                List.of(AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS)))
                .thenReturn(false);
        when(deliveryHubRepository.findById(hubId))
                .thenReturn(Optional.of(DeliveryHub.builder().id(hubId).townId(townId).name("Narsaraopet Hub").build()));
        when(deliveryAssignmentRepository.save(any())).thenAnswer(invocation -> {
            DeliveryAssignment assignment = invocation.getArgument(0);
            assignment.setId(UUID.randomUUID());
            return assignment;
        });

        AssignmentResponse response = assignmentService.assignPickup(hubAdminUserId, request);

        assertThat(response.getStatus()).isEqualTo(AssignmentStatus.ASSIGNED);
        assertThat(response.getLegType()).isEqualTo(AssignmentLegType.PICKUP);
        assertThat(response.getVendorSubOrderId()).isEqualTo(subOrderId);
        assertThat(response.getOrderId()).isEqualTo(orderId);
        assertThat(response.getAgentId()).isEqualTo(agentId);
        assertThat(response.getHubId()).isEqualTo(hubId);
        assertThat(response.getAssignmentNumber()).isEqualTo("NRPT/AP-260708-O0001-1/2-TO-HUB");
        assertThat(response.getOrderNumber()).isEqualTo("NRPT/AP-260708-O0001");
        assertThat(response.getSubOrderNumber()).isEqualTo("NRPT/AP-260708-O0001-1/2");
    }
}

package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.delivery.dto.request.ReassignAssignmentRequest;
import com.hyperlocalmart.delivery.dto.response.AssignmentResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignmentReassignTest {

    @Mock private HubAdminRepository hubAdminRepository;
    @Mock private DeliveryHubRepository deliveryHubRepository;
    @Mock private DeliveryAgentRepository deliveryAgentRepository;
    @Mock private AgentHubLinkRepository agentHubLinkRepository;
    @Mock private DeliveryAssignmentRepository deliveryAssignmentRepository;
    @Mock private DeliveryEventRepository deliveryEventRepository;
    @Mock private com.hyperlocalmart.delivery.client.OrderClient orderClient;
    @Mock private DeliveryOtpService deliveryOtpService;
    @Mock private com.hyperlocalmart.delivery.client.NotificationClient notificationClient;

    @InjectMocks
    private AssignmentService assignmentService;

    @Test
    void reassign_updatesAgentOnActiveAssignment() {
        UUID hubAdminUserId = UUID.fromString("00000000-0000-4000-8000-000000000201");
        UUID hubId = UUID.fromString("d1111111-1111-4111-8111-111111111111");
        UUID assignmentId = UUID.randomUUID();
        UUID oldAgentId = UUID.fromString("e1111111-1111-4111-8111-111111111111");
        UUID newAgentId = UUID.randomUUID();

        ReassignAssignmentRequest request = new ReassignAssignmentRequest();
        request.setNewAgentId(newAgentId);
        request.setReason("Agent inactive");

        DeliveryAssignment assignment = DeliveryAssignment.builder()
                .id(assignmentId)
                .orderId(UUID.randomUUID())
                .hubId(hubId)
                .agentId(oldAgentId)
                .legType(AssignmentLegType.PICKUP)
                .status(AssignmentStatus.ASSIGNED)
                .build();

        when(hubAdminRepository.findByUserIdAndStatus(hubAdminUserId, "ACTIVE"))
                .thenReturn(Optional.of(HubAdmin.builder().hubId(hubId).userId(hubAdminUserId).status("ACTIVE").build()));
        when(deliveryAssignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
        when(deliveryAgentRepository.findById(newAgentId))
                .thenReturn(Optional.of(DeliveryAgent.builder().id(newAgentId).status(AgentStatus.ACTIVE).build()));
        when(agentHubLinkRepository.existsByAgentIdAndHubIdAndActiveTrue(newAgentId, hubId)).thenReturn(true);
        when(deliveryAssignmentRepository.save(assignment)).thenReturn(assignment);

        AssignmentResponse response = assignmentService.reassign(hubAdminUserId, assignmentId, request);

        assertThat(response.getAgentId()).isEqualTo(newAgentId);
        assertThat(response.getStatus()).isEqualTo(AssignmentStatus.ASSIGNED);
    }
}

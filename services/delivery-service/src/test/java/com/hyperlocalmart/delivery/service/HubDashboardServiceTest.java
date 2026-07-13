package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.delivery.client.OrderClient;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HubDashboardServiceTest {

    @Mock private HubAdminRepository hubAdminRepository;
    @Mock private DeliveryHubRepository deliveryHubRepository;
    @Mock private AgentHubLinkRepository agentHubLinkRepository;
    @Mock private DeliveryAgentRepository deliveryAgentRepository;
    @Mock private DeliveryAssignmentRepository deliveryAssignmentRepository;
    @Mock private OrderClient orderClient;

    @InjectMocks
    private HubDashboardService hubDashboardService;

    @Test
    void getDashboard_returnsOperationalCounts() {
        UUID hubAdminUserId = UUID.fromString("00000000-0000-4000-8000-000000000201");
        UUID hubId = UUID.fromString("d1111111-1111-4111-8111-111111111111");
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");
        UUID agentId = UUID.fromString("e1111111-1111-4111-8111-111111111111");

        when(hubAdminRepository.findByUserIdAndStatus(hubAdminUserId, "ACTIVE"))
                .thenReturn(Optional.of(HubAdmin.builder().hubId(hubId).userId(hubAdminUserId).status("ACTIVE").build()));
        when(deliveryHubRepository.findById(hubId))
                .thenReturn(Optional.of(DeliveryHub.builder().id(hubId).townId(townId).name("Narsaraopet Hub").build()));
        when(agentHubLinkRepository.findByHubIdAndActiveTrue(hubId))
                .thenReturn(List.of(AgentHubLink.builder().agentId(agentId).hubId(hubId).active(true).build()));
        when(deliveryAgentRepository.findById(agentId))
                .thenReturn(Optional.of(DeliveryAgent.builder().id(agentId).status(AgentStatus.ACTIVE).build()));
        when(orderClient.getHubOrderStats(townId)).thenReturn(new OrderClient.HubOrderStats(3, 2));
        when(deliveryAssignmentRepository.countByHubIdAndLegTypeAndStatus(any(), any(), any())).thenReturn(1L, 0L, 1L, 0L);
        when(deliveryAssignmentRepository.countCompletedByHubIdAndLegTypeBetween(any(), any(), any(), any())).thenReturn(5L, 4L);
        when(deliveryAssignmentRepository.countByHubIdAndStatusIn(eq(hubId), any())).thenReturn(2L);

        var dashboard = hubDashboardService.getDashboard(hubAdminUserId, hubId);

        assertThat(dashboard.getHubName()).isEqualTo("Narsaraopet Hub");
        assertThat(dashboard.getActiveAgents()).isEqualTo(1);
        assertThat(dashboard.getOrders().getReadyForPickup()).isEqualTo(3);
        assertThat(dashboard.getActiveAssignments()).isEqualTo(2);
    }
}

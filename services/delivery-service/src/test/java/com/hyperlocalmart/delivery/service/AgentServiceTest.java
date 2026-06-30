package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.delivery.dto.request.CreateAgentRequest;
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
class AgentServiceTest {

    @Mock private HubAdminRepository hubAdminRepository;
    @Mock private DeliveryHubRepository deliveryHubRepository;
    @Mock private DeliveryAgentRepository deliveryAgentRepository;
    @Mock private AgentHubLinkRepository agentHubLinkRepository;
    @Mock private DeliveryAssignmentRepository deliveryAssignmentRepository;

    @InjectMocks
    private AgentService agentService;

    @Test
    void createAgent_linksAgentToHub() {
        UUID hubAdminUserId = UUID.fromString("00000000-0000-4000-8000-000000000201");
        UUID hubId = UUID.fromString("d1111111-1111-4111-8111-111111111111");
        UUID townId = UUID.fromString("a1111111-1111-4111-8111-111111111111");
        UUID agentUserId = UUID.randomUUID();

        CreateAgentRequest request = new CreateAgentRequest();
        request.setUserId(agentUserId);
        request.setName("New Agent");
        request.setPhone("9876500300");

        when(hubAdminRepository.findByUserIdAndStatus(hubAdminUserId, "ACTIVE"))
                .thenReturn(Optional.of(HubAdmin.builder().hubId(hubId).userId(hubAdminUserId).status("ACTIVE").build()));
        when(deliveryHubRepository.findById(hubId))
                .thenReturn(Optional.of(DeliveryHub.builder().id(hubId).townId(townId).name("Narsaraopet Hub").build()));
        when(deliveryAgentRepository.existsByUserId(agentUserId)).thenReturn(false);
        when(deliveryAgentRepository.existsByPhone("9876500300")).thenReturn(false);
        when(deliveryAgentRepository.save(any())).thenAnswer(invocation -> {
            DeliveryAgent agent = invocation.getArgument(0);
            agent.setId(UUID.randomUUID());
            return agent;
        });
        when(agentHubLinkRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = agentService.createAgent(hubAdminUserId, request);

        assertThat(response.getName()).isEqualTo("New Agent");
        assertThat(response.getHubId()).isEqualTo(hubId);
        assertThat(response.getStatus()).isEqualTo(AgentStatus.ACTIVE);
    }
}

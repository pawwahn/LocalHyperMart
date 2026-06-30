package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.request.CreateAgentRequest;
import com.hyperlocalmart.delivery.dto.request.UpdateAgentStatusRequest;
import com.hyperlocalmart.delivery.dto.response.AgentResponse;
import com.hyperlocalmart.delivery.dto.response.HubAdminContextResponse;
import com.hyperlocalmart.delivery.dto.response.OrderAssignmentResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentService {

    private static final String HUB_ADMIN_ACTIVE = "ACTIVE";

    private final HubAdminRepository hubAdminRepository;
    private final DeliveryHubRepository deliveryHubRepository;
    private final DeliveryAgentRepository deliveryAgentRepository;
    private final AgentHubLinkRepository agentHubLinkRepository;
    private final DeliveryAssignmentRepository deliveryAssignmentRepository;

    @Transactional(readOnly = true)
    public HubAdminContextResponse getHubAdminContext(UUID userId) {
        HubAdmin hubAdmin = hubAdminRepository.findByUserIdAndStatus(userId, HUB_ADMIN_ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub admin not found"));
        DeliveryHub hub = deliveryHubRepository.findById(hubAdmin.getHubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));
        return HubAdminContextResponse.builder()
                .userId(userId)
                .hubId(hub.getId())
                .townId(hub.getTownId())
                .build();
    }

    @Transactional(readOnly = true)
    public List<OrderAssignmentResponse> getAssignmentsForOrder(UUID orderId) {
        return deliveryAssignmentRepository.findByOrderIdOrderByAssignedAtDesc(orderId).stream()
                .map(a -> OrderAssignmentResponse.builder()
                        .assignmentId(a.getId())
                        .agentId(a.getAgentId())
                        .legType(a.getLegType().name())
                        .status(a.getStatus().name())
                        .assignedAt(a.getAssignedAt())
                        .completedAt(a.getCompletedAt())
                        .build())
                .toList();
    }

    @Transactional
    public AgentResponse createAgent(UUID hubAdminUserId, CreateAgentRequest request) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        DeliveryHub hub = deliveryHubRepository.findById(hubAdmin.getHubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));

        if (deliveryAgentRepository.existsByUserId(request.getUserId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "User is already linked to a delivery agent");
        }
        if (deliveryAgentRepository.existsByPhone(request.getPhone())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Phone already registered for an agent");
        }

        DeliveryAgent agent = DeliveryAgent.builder()
                .userId(request.getUserId())
                .name(request.getName())
                .phone(request.getPhone())
                .status(AgentStatus.ACTIVE)
                .build();
        agent.setCreatedBy(hubAdminUserId);
        agent.setUpdatedBy(hubAdminUserId);
        deliveryAgentRepository.save(agent);

        AgentHubLink link = AgentHubLink.builder()
                .agentId(agent.getId())
                .hubId(hub.getId())
                .townId(hub.getTownId())
                .active(true)
                .build();
        link.setCreatedBy(hubAdminUserId);
        link.setUpdatedBy(hubAdminUserId);
        agentHubLinkRepository.save(link);

        return toResponse(agent, hub.getId());
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> listAgents(UUID hubAdminUserId, UUID hubId) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        if (!hubAdmin.getHubId().equals(hubId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub does not belong to admin");
        }
        List<AgentResponse> agents = new ArrayList<>();
        for (AgentHubLink link : agentHubLinkRepository.findByHubIdAndActiveTrue(hubId)) {
            deliveryAgentRepository.findById(link.getAgentId())
                    .ifPresent(agent -> agents.add(toResponse(agent, hubId)));
        }
        return agents;
    }

    @Transactional
    public AgentResponse updateAgentStatus(UUID actorUserId, List<String> roles, UUID agentId, UpdateAgentStatusRequest request) {
        DeliveryAgent agent = deliveryAgentRepository.findById(agentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Agent not found"));

        if (request.getStatus() == AgentStatus.DISABLED && !roles.contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only super admin can disable agents permanently");
        }

        if (roles.contains("HUB_ADMIN") && !roles.contains("SUPER_ADMIN")) {
            HubAdmin hubAdmin = resolveActiveHubAdmin(actorUserId);
            ensureAgentLinkedToHub(agentId, hubAdmin.getHubId());
        }

        if (request.getStatus() == AgentStatus.DISABLED) {
            agent.setDisabledBy(actorUserId);
        }
        agent.setStatus(request.getStatus());
        agent.setUpdatedBy(actorUserId);
        deliveryAgentRepository.save(agent);

        return toResponse(agent, resolveHubIdForAgent(agentId));
    }

    private UUID resolveHubIdForAgent(UUID agentId) {
        return agentHubLinkRepository.findFirstByAgentIdAndActiveTrue(agentId)
                .map(AgentHubLink::getHubId)
                .orElse(null);
    }

    private void ensureAgentLinkedToHub(UUID agentId, UUID hubId) {
        if (!agentHubLinkRepository.existsByAgentIdAndHubIdAndActiveTrue(agentId, hubId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Agent is not linked to your hub");
        }
    }

    private HubAdmin resolveActiveHubAdmin(UUID hubAdminUserId) {
        return hubAdminRepository.findByUserIdAndStatus(hubAdminUserId, HUB_ADMIN_ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "Active hub admin not found"));
    }

    private AgentResponse toResponse(DeliveryAgent agent, UUID hubId) {
        return AgentResponse.builder()
                .agentId(agent.getId())
                .userId(agent.getUserId())
                .hubId(hubId)
                .name(agent.getName())
                .phone(agent.getPhone())
                .status(agent.getStatus())
                .build();
    }
}

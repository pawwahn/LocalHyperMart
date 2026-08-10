package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.UserClient;
import com.hyperlocalmart.delivery.dto.request.CreateAgentRequest;
import com.hyperlocalmart.delivery.dto.request.UpdateAgentStatusRequest;
import com.hyperlocalmart.delivery.dto.response.AgentMeResponse;
import com.hyperlocalmart.delivery.dto.response.AgentResponse;
import com.hyperlocalmart.delivery.dto.response.DeliveryEventResponse;
import com.hyperlocalmart.delivery.dto.response.HubContactResponse;
import com.hyperlocalmart.delivery.dto.response.HubAdminContextResponse;
import com.hyperlocalmart.delivery.dto.response.OrderAssignmentResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private static final String HUB_ADMIN_ACTIVE = "ACTIVE";

    private final HubAdminRepository hubAdminRepository;
    private final DeliveryHubRepository deliveryHubRepository;
    private final DeliveryAgentRepository deliveryAgentRepository;
    private final AgentHubLinkRepository agentHubLinkRepository;
    private final DeliveryAssignmentRepository deliveryAssignmentRepository;
    private final DeliveryEventRepository deliveryEventRepository;
    private final UserClient userClient;

    @Transactional(readOnly = true)
    public AgentMeResponse getMyAgent(UUID userId) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));
        AgentHubLink link = agentHubLinkRepository.findFirstByAgentIdAndActiveTrue(agent.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Agent hub link not found"));
        DeliveryHub hub = deliveryHubRepository.findById(link.getHubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));
        return AgentMeResponse.builder()
                .agentId(agent.getId())
                .userId(agent.getUserId())
                .name(agent.getName())
                .phone(agent.getPhone())
                .status(agent.getStatus())
                .hubId(hub.getId())
                .townId(hub.getTownId())
                .build();
    }

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
    public List<HubContactResponse> listHubContactsForTown(UUID townId) {
        List<HubAdmin> admins = hubAdminRepository.findActiveByTownId(townId, HUB_ADMIN_ACTIVE, HUB_ADMIN_ACTIVE);
        if (admins.isEmpty()) {
            return List.of();
        }
        List<HubContactResponse> contacts = new ArrayList<>();
        for (HubAdmin admin : admins) {
            DeliveryHub hub = deliveryHubRepository.findById(admin.getHubId()).orElse(null);
            if (hub == null) {
                continue;
            }
            contacts.add(HubContactResponse.builder()
                    .userId(admin.getUserId())
                    .hubId(hub.getId())
                    .hubName(hub.getName())
                    .phone(hub.getPhone())
                    .build());
        }
        return contacts;
    }

    @Transactional(readOnly = true)
    public List<OrderAssignmentResponse> getAssignmentsForOrder(UUID orderId) {
        List<DeliveryAssignment> assignments =
                deliveryAssignmentRepository.findByOrderIdOrderByAssignedAtDesc(orderId);
        Map<UUID, List<DeliveryEventResponse>> eventsByAssignment = loadEventResponses(
                assignments.stream().map(DeliveryAssignment::getId).toList());
        List<UUID> agentIds = assignments.stream()
                .map(DeliveryAssignment::getAgentId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        Map<UUID, DeliveryAgent> agentsById = agentIds.isEmpty()
                ? Map.of()
                : deliveryAgentRepository.findAllById(agentIds).stream()
                        .collect(Collectors.toMap(DeliveryAgent::getId, a -> a, (a, b) -> a));
        return assignments.stream()
                .map(a -> {
                    List<DeliveryEventResponse> events =
                            eventsByAssignment.getOrDefault(a.getId(), List.of());
                    DeliveryAgent agent = agentsById.get(a.getAgentId());
                    return OrderAssignmentResponse.builder()
                            .assignmentId(a.getId())
                            .assignmentNumber(a.getAssignmentNumber())
                            .orderNumber(a.getOrderNumber())
                            .subOrderNumber(a.getSubOrderNumber())
                            .agentId(a.getAgentId())
                            .agentName(agent == null ? null : agent.getName())
                            .agentPhone(agent == null ? null : agent.getPhone())
                            .legType(a.getLegType().name())
                            .status(a.getStatus().name())
                            .assignedAt(a.getAssignedAt())
                            .startedAt(deriveStartedAt(events))
                            .completedAt(a.getCompletedAt())
                            .events(events)
                            .build();
                })
                .toList();
    }

    private Map<UUID, List<DeliveryEventResponse>> loadEventResponses(List<UUID> assignmentIds) {
        if (assignmentIds == null || assignmentIds.isEmpty()) {
            return Map.of();
        }
        return deliveryEventRepository.findByAssignmentIdInOrderByCreatedAtAsc(assignmentIds).stream()
                .collect(Collectors.groupingBy(
                        DeliveryEvent::getAssignmentId,
                        Collectors.mapping(e -> DeliveryEventResponse.builder()
                                .eventId(e.getId())
                                .eventType(e.getEventType())
                                .createdAt(e.getCreatedAt())
                                .createdBy(e.getCreatedBy())
                                .metadata(e.getMetadata())
                                .build(), Collectors.toList())));
    }

    private Instant deriveStartedAt(List<DeliveryEventResponse> events) {
        return events.stream()
                .filter(e -> e.getEventType() != null && e.getEventType().startsWith("PICKED_"))
                .map(DeliveryEventResponse::getCreatedAt)
                .findFirst()
                .orElse(null);
    }

    @Transactional
    public AgentResponse createAgent(UUID hubAdminUserId, CreateAgentRequest request) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        DeliveryHub hub = deliveryHubRepository.findById(hubAdmin.getHubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));

        String phone = request.getPhone().trim();
        String name = request.getName().trim();
        if (deliveryAgentRepository.existsByPhone(phone)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Phone already registered for an agent");
        }

        UUID agentUserId = userClient.createDeliveryAgentUser(phone, request.getPassword(), name);
        try {
            if (deliveryAgentRepository.existsByUserId(agentUserId)) {
                throw new BusinessException(ErrorCode.CONFLICT, "User is already linked to a delivery agent");
            }

            DeliveryAgent agent = DeliveryAgent.builder()
                    .userId(agentUserId)
                    .name(name)
                    .phone(phone)
                    .status(AgentStatus.ACTIVE)
                    .govtIdType(request.getGovtIdType().trim().toUpperCase())
                    .govtIdNumber(request.getGovtIdNumber().replaceAll("\\s", "").trim())
                    .reference1Name(request.getReference1Name().trim())
                    .reference1Phone(request.getReference1Phone().trim())
                    .reference2Name(request.getReference2Name().trim())
                    .reference2Phone(request.getReference2Phone().trim())
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

            return toResponse(agent, hub);
        } catch (RuntimeException ex) {
            try {
                userClient.updateUserStatus(agentUserId, "DISABLED");
            } catch (Exception cleanup) {
                log.warn("Failed to roll back agent login {} after create failure: {}", agentUserId, cleanup.getMessage());
            }
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> listAgents(UUID hubAdminUserId, UUID hubId) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        if (!hubAdmin.getHubId().equals(hubId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub does not belong to admin");
        }
        DeliveryHub hub = deliveryHubRepository.findById(hubId).orElse(null);
        List<AgentResponse> agents = new ArrayList<>();
        for (AgentHubLink link : agentHubLinkRepository.findByHubIdAndActiveTrue(hubId)) {
            deliveryAgentRepository.findById(link.getAgentId())
                    .ifPresent(agent -> agents.add(toResponse(agent, hub)));
        }
        return agents;
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> listAllAgentsForSuperAdmin() {
        List<AgentResponse> agents = new ArrayList<>();
        for (DeliveryAgent agent : deliveryAgentRepository.findAll()) {
            UUID hubId = resolveHubIdForAgent(agent.getId());
            DeliveryHub hub = hubId == null ? null : deliveryHubRepository.findById(hubId).orElse(null);
            agents.add(toResponse(agent, hub));
        }
        agents.sort((a, b) -> {
            int byHub = String.valueOf(a.getHubName()).compareToIgnoreCase(String.valueOf(b.getHubName()));
            if (byHub != 0) return byHub;
            return a.getName().compareToIgnoreCase(b.getName());
        });
        return agents;
    }

    @Transactional
    public AgentResponse updateAgentStatus(UUID actorUserId, List<String> roles, UUID agentId, UpdateAgentStatusRequest request) {
        DeliveryAgent agent = deliveryAgentRepository.findById(agentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Agent not found"));
        boolean superAdmin = roles.contains("SUPER_ADMIN");

        if (request.getStatus() == AgentStatus.DISABLED && !superAdmin) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only super admin can permanently disable agents");
        }
        if (!superAdmin) {
            if (request.getStatus() != AgentStatus.ACTIVE && request.getStatus() != AgentStatus.INACTIVE) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin can only activate or deactivate agents");
            }
            if (agent.getStatus() == AgentStatus.DISABLED) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Permanently disabled agents can only be restored by super admin");
            }
            HubAdmin hubAdmin = resolveActiveHubAdmin(actorUserId);
            ensureAgentLinkedToHub(agentId, hubAdmin.getHubId());
        }

        if (request.getStatus() == AgentStatus.DISABLED) {
            agent.setDisabledBy(actorUserId);
        } else if (agent.getStatus() == AgentStatus.DISABLED && request.getStatus() == AgentStatus.ACTIVE) {
            agent.setDisabledBy(null);
        }
        agent.setStatus(request.getStatus());
        agent.setUpdatedBy(actorUserId);
        deliveryAgentRepository.save(agent);

        syncLoginStatus(agent);

        UUID hubId = resolveHubIdForAgent(agentId);
        DeliveryHub hub = hubId == null ? null : deliveryHubRepository.findById(hubId).orElse(null);
        return toResponse(agent, hub);
    }

    @Transactional
    public AgentResponse permanentlyDisableAgent(UUID superAdminUserId, UUID agentId) {
        UpdateAgentStatusRequest request = new UpdateAgentStatusRequest();
        request.setStatus(AgentStatus.DISABLED);
        return updateAgentStatus(superAdminUserId, List.of("SUPER_ADMIN"), agentId, request);
    }

    private void syncLoginStatus(DeliveryAgent agent) {
        if (agent.getUserId() == null) return;
        try {
            if (agent.getStatus() == AgentStatus.DISABLED) {
                userClient.updateUserStatus(agent.getUserId(), "DISABLED");
            } else if (agent.getStatus() == AgentStatus.ACTIVE || agent.getStatus() == AgentStatus.INACTIVE) {
                // Keep login usable while inactive so boy can still open app; assignments block INACTIVE.
                userClient.updateUserStatus(agent.getUserId(), "ACTIVE");
            }
        } catch (Exception ex) {
            log.warn("Could not sync login status for agent {}: {}", agent.getId(), ex.getMessage());
        }
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

    private AgentResponse toResponse(DeliveryAgent agent, DeliveryHub hub) {
        return AgentResponse.builder()
                .agentId(agent.getId())
                .userId(agent.getUserId())
                .hubId(hub == null ? null : hub.getId())
                .hubName(hub == null ? null : hub.getName())
                .name(agent.getName())
                .phone(agent.getPhone())
                .status(agent.getStatus())
                .govtIdType(agent.getGovtIdType())
                .govtIdNumber(maskGovtId(agent.getGovtIdNumber()))
                .reference1Name(agent.getReference1Name())
                .reference1Phone(agent.getReference1Phone())
                .reference2Name(agent.getReference2Name())
                .reference2Phone(agent.getReference2Phone())
                .build();
    }

    /** Show only last 4 characters of government ID in API responses. */
    private static String maskGovtId(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 4) {
            return "****";
        }
        return "****" + trimmed.substring(trimmed.length() - 4);
    }
}

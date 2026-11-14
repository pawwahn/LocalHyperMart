package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.client.SyncFieldAgentRequest;
import com.hyperlocalmart.delivery.client.UserClient;
import com.hyperlocalmart.delivery.client.VendorClient;
import com.hyperlocalmart.delivery.dto.request.CreateVendorAgentRequest;
import com.hyperlocalmart.delivery.dto.request.UpdateAgentStatusRequest;
import com.hyperlocalmart.delivery.dto.request.UpdateVendorAgentRequest;
import com.hyperlocalmart.delivery.dto.response.AgentResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.AgentVendorLinkRepository;
import com.hyperlocalmart.delivery.repository.DeliveryAgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class VendorAgentService {

    private static final String VENDOR_AGENT_STATUS = "DELIVERY_BY_VENDOR_AGENT";

    private final DeliveryAgentRepository deliveryAgentRepository;
    private final AgentVendorLinkRepository agentVendorLinkRepository;
    private final UserClient userClient;
    private final OrderClient orderClient;
    private final AssignmentService assignmentService;
    private final VendorClient vendorClient;

    @Transactional(readOnly = true)
    public List<AgentResponse> listAgents(UUID vendorId) {
        return deliveryAgentRepository.findByVendorIdAndAgentTypeOrderByNameAsc(vendorId, AgentType.VENDOR).stream()
                .filter(a -> a.getStatus() != AgentStatus.DISABLED)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AgentResponse updateAgent(UUID vendorId, UUID agentId, UUID actorUserId, UpdateVendorAgentRequest request) {
        DeliveryAgent agent = requireVendorAgent(vendorId, agentId);
        agent.setName(request.getName().trim());
        agent.setGovtIdType(blankToNull(request.getGovtIdType()));
        agent.setGovtIdNumber(blankToNull(request.getGovtIdNumber()));
        agent.setReference1Name(blankToNull(request.getReference1Name()));
        agent.setReference1Phone(blankToNull(request.getReference1Phone()));
        agent.setReference2Name(blankToNull(request.getReference2Name()));
        agent.setReference2Phone(blankToNull(request.getReference2Phone()));
        applyLabRole(agent, request.getLabTitle(), request.getCollectionCapable());
        agent.setUpdatedBy(actorUserId);
        deliveryAgentRepository.save(agent);
        syncDiagnosticsStaff(agent);
        return toResponse(agent);
    }

    @Transactional
    public AgentResponse updateAgentStatus(UUID vendorId, UUID agentId, UUID actorUserId, UpdateAgentStatusRequest request) {
        DeliveryAgent agent = requireVendorAgent(vendorId, agentId);
        if (request.getStatus() != AgentStatus.ACTIVE && request.getStatus() != AgentStatus.INACTIVE) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "You can only activate or pause shop agents");
        }
        if (request.getStatus() == AgentStatus.DISABLED) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Contact support to permanently remove an agent");
        }
        if (agent.getStatus() == AgentStatus.DISABLED) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "This agent was permanently disabled by support");
        }
        agent.setStatus(request.getStatus());
        agent.setUpdatedBy(actorUserId);
        deliveryAgentRepository.save(agent);
        syncLoginStatus(agent);
        syncDiagnosticsStaff(agent);
        return toResponse(agent);
    }

    private DeliveryAgent requireVendorAgent(UUID vendorId, UUID agentId) {
        return deliveryAgentRepository.findByIdAndVendorIdAndAgentType(agentId, vendorId, AgentType.VENDOR)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Agent not found"));
    }

    private void syncLoginStatus(DeliveryAgent agent) {
        if (agent.getUserId() == null) {
            return;
        }
        try {
            if (agent.getStatus() == AgentStatus.DISABLED) {
                userClient.updateUserStatus(agent.getUserId(), "DISABLED");
            } else if (agent.getStatus() == AgentStatus.ACTIVE || agent.getStatus() == AgentStatus.INACTIVE) {
                userClient.updateUserStatus(agent.getUserId(), "ACTIVE");
            }
        } catch (Exception ex) {
            log.warn("Could not sync login status for agent {}: {}", agent.getId(), ex.getMessage());
        }
    }

    @Transactional
    public AgentResponse createAgent(UUID vendorId, UUID shopId, UUID townId, UUID actorUserId, CreateVendorAgentRequest request) {
        String phone = request.getPhone().trim();
        String name = request.getName().trim();
        if (deliveryAgentRepository.existsByPhone(phone)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Phone already registered for an agent");
        }

        UUID agentUserId = userClient.createDeliveryAgentUser(phone, request.getPassword(), name);
        try {
            DeliveryAgent agent = DeliveryAgent.builder()
                    .userId(agentUserId)
                    .name(name)
                    .phone(phone)
                    .agentType(AgentType.VENDOR)
                    .vendorId(vendorId)
                    .shopId(shopId)
                    .status(AgentStatus.ACTIVE)
                    .govtIdType(blankToNull(request.getGovtIdType()))
                    .govtIdNumber(blankToNull(request.getGovtIdNumber()))
                    .reference1Name(blankToNull(request.getReference1Name()))
                    .reference1Phone(blankToNull(request.getReference1Phone()))
                    .reference2Name(blankToNull(request.getReference2Name()))
                    .reference2Phone(blankToNull(request.getReference2Phone()))
                    .build();
            applyLabRole(agent, request.getLabTitle(), request.getCollectionCapable());
            agent.setCreatedBy(actorUserId);
            agent.setUpdatedBy(actorUserId);
            deliveryAgentRepository.save(agent);

            AgentVendorLink link = AgentVendorLink.builder()
                    .agentId(agent.getId())
                    .vendorId(vendorId)
                    .shopId(shopId)
                    .townId(townId)
                    .active(true)
                    .build();
            link.setCreatedBy(actorUserId);
            link.setUpdatedBy(actorUserId);
            agentVendorLinkRepository.save(link);

            syncDiagnosticsStaff(agent);
            return toResponse(agent);
        } catch (RuntimeException ex) {
            throw ex;
        }
    }

    @Transactional
    public void assignVendorDirect(UUID vendorId, UUID vendorSubOrderId, UUID agentId, UUID assignedBy) {
        OrderClient.SubOrderSnapshot subOrder = orderClient.getSubOrder(vendorSubOrderId);
        if (!vendorId.equals(subOrder.vendorId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Sub-order does not belong to vendor");
        }
        if (!VENDOR_AGENT_STATUS.equals(subOrder.status())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Sub-order is not in vendor-agent delivery mode");
        }
        assignmentService.assignVendorDirect(subOrder, vendorId, agentId, assignedBy);
    }

    private AgentResponse toResponse(DeliveryAgent agent) {
        AgentVendorLink link = agentVendorLinkRepository.findFirstByAgentIdAndActiveTrue(agent.getId()).orElse(null);
        return AgentResponse.builder()
                .agentId(agent.getId())
                .userId(agent.getUserId())
                .hubId(null)
                .hubName(null)
                .townId(link == null ? null : link.getTownId())
                .name(agent.getName())
                .phone(agent.getPhone())
                .status(agent.getStatus())
                .agentType(agent.getAgentType())
                .vendorId(agent.getVendorId())
                .shopId(agent.getShopId())
                .govtIdType(agent.getGovtIdType())
                .govtIdNumber(agent.getGovtIdNumber())
                .reference1Name(agent.getReference1Name())
                .reference1Phone(agent.getReference1Phone())
                .reference2Name(agent.getReference2Name())
                .reference2Phone(agent.getReference2Phone())
                .labTitle(agent.getLabTitle())
                .collectionCapable(agent.isCollectionCapable())
                .build();
    }

    private void applyLabRole(DeliveryAgent agent, String labTitle, Boolean collectionCapable) {
        if (labTitle == null) {
            return;
        }
        String normalized = labTitle.trim().toUpperCase();
        if (normalized.isEmpty() || "DELIVERY_ONLY".equals(normalized)) {
            normalized = "COLLECTION_AGENT";
        }
        agent.setLabTitle(normalized);
        if (collectionCapable != null) {
            agent.setCollectionCapable(collectionCapable);
        } else if (agent.getLabTitle() != null) {
            agent.setCollectionCapable(
                    "COLLECTION_AGENT".equalsIgnoreCase(agent.getLabTitle())
                            || "MANAGER".equalsIgnoreCase(agent.getLabTitle()));
        }
    }

    private void syncDiagnosticsStaff(DeliveryAgent agent) {
        if (agent.getVendorId() == null || agent.getUserId() == null) {
            return;
        }
        try {
            vendorClient.syncDiagnosticsFieldAgent(SyncFieldAgentRequest.builder()
                    .vendorId(agent.getVendorId())
                    .userId(agent.getUserId())
                    .displayName(agent.getName())
                    .phone(agent.getPhone())
                    .labTitle(agent.getLabTitle())
                    .collectionCapable(agent.isCollectionCapable())
                    .deliveryActive(agent.getStatus() == AgentStatus.ACTIVE)
                    .build());
        } catch (Exception ex) {
            log.warn("Could not sync diagnostics staff for agent {}: {}", agent.getId(), ex.getMessage());
        }
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.client.UserClient;
import com.hyperlocalmart.delivery.dto.request.CreateVendorAgentRequest;
import com.hyperlocalmart.delivery.dto.response.AgentResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.AgentVendorLinkRepository;
import com.hyperlocalmart.delivery.repository.DeliveryAgentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorAgentService {

    private static final String VENDOR_AGENT_STATUS = "DELIVERY_BY_VENDOR_AGENT";

    private final DeliveryAgentRepository deliveryAgentRepository;
    private final AgentVendorLinkRepository agentVendorLinkRepository;
    private final UserClient userClient;
    private final OrderClient orderClient;
    private final AssignmentService assignmentService;

    @Transactional(readOnly = true)
    public List<AgentResponse> listAgents(UUID vendorId) {
        return agentVendorLinkRepository.findByVendorIdAndActiveTrue(vendorId).stream()
                .map(link -> deliveryAgentRepository.findById(link.getAgentId()).orElse(null))
                .filter(a -> a != null && a.getAgentType() == AgentType.VENDOR)
                .map(this::toResponse)
                .toList();
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
                .build();
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

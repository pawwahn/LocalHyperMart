package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.dto.response.DeliveryAgentAlertResponse;
import com.hyperlocalmart.delivery.dto.response.SubOrderAgentAlertSummaryResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.DeliveryAgentAlertRepository;
import com.hyperlocalmart.delivery.repository.DeliveryAgentRepository;
import com.hyperlocalmart.delivery.repository.DeliveryAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DeliveryAgentAlertService {

    private static final String VENDOR_AGENT_STATUS = "DELIVERY_BY_VENDOR_AGENT";
    private static final Set<AssignmentStatus> NOTIFYABLE_ASSIGNMENT = EnumSet.of(
            AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS);

    private final DeliveryAgentAlertRepository deliveryAgentAlertRepository;
    private final DeliveryAssignmentRepository deliveryAssignmentRepository;
    private final DeliveryAgentRepository deliveryAgentRepository;
    private final OrderClient orderClient;

    @Transactional
    public DeliveryAgentAlertResponse createForVendorSubOrder(
            UUID vendorSubOrderId, UUID vendorId, UUID actorUserId) {
        OrderClient.SubOrderSnapshot sub = orderClient.getSubOrder(vendorSubOrderId);
        if (!vendorId.equals(sub.vendorId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Sub-order does not belong to vendor");
        }
        return createAlertForSubOrder(sub, actorUserId);
    }

    @Transactional
    public DeliveryAgentAlertResponse createForHubSubOrder(UUID vendorSubOrderId, UUID townId, UUID actorUserId) {
        OrderClient.SubOrderSnapshot sub = orderClient.getSubOrder(vendorSubOrderId);
        if (!townId.equals(sub.townId())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Shop bag not found");
        }
        return createAlertForSubOrder(sub, actorUserId);
    }

    private DeliveryAgentAlertResponse createAlertForSubOrder(OrderClient.SubOrderSnapshot sub, UUID actorUserId) {
        if (!VENDOR_AGENT_STATUS.equals(sub.status())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Notify agent only for shop-agent delivery bags");
        }
        DeliveryAssignment assignment = deliveryAssignmentRepository
                .findByVendorSubOrderIdAndLegTypeAndStatus(
                        sub.subOrderId(), AssignmentLegType.VENDOR_DIRECT, AssignmentStatus.ASSIGNED)
                .or(() -> deliveryAssignmentRepository.findByVendorSubOrderIdAndLegTypeAndStatus(
                        sub.subOrderId(), AssignmentLegType.VENDOR_DIRECT, AssignmentStatus.IN_PROGRESS))
                .orElseThrow(() -> new BusinessException(ErrorCode.CONFLICT,
                        "Assign a delivery agent before notifying"));
        if (!NOTIFYABLE_ASSIGNMENT.contains(assignment.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Assignment is not active");
        }
        if (deliveryAgentAlertRepository.existsByAssignmentIdAndStatus(
                assignment.getId(), DeliveryAgentAlertStatus.PENDING)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Agent is already being alerted — wait until they tap Got it");
        }

        DeliveryAgentAlert alert = DeliveryAgentAlert.builder()
                .assignmentId(assignment.getId())
                .agentId(assignment.getAgentId())
                .orderId(sub.orderId())
                .vendorSubOrderId(sub.subOrderId())
                .vendorId(sub.vendorId())
                .shopId(sub.shopId())
                .townId(sub.townId())
                .status(DeliveryAgentAlertStatus.PENDING)
                .build();
        alert.setCreatedBy(actorUserId);
        deliveryAgentAlertRepository.save(alert);
        return toResponse(alert, sub, assignment);
    }

    @Transactional(readOnly = true)
    public List<DeliveryAgentAlertResponse> listPendingForAgentUser(UUID agentUserId) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Agent not found"));
        return deliveryAgentAlertRepository
                .findByAgentIdAndStatusOrderByCreatedAtDesc(agent.getId(), DeliveryAgentAlertStatus.PENDING)
                .stream()
                .map(this::toResponseResolved)
                .toList();
    }

    @Transactional
    public DeliveryAgentAlertResponse acknowledge(UUID agentUserId, UUID alertId) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Agent not found"));
        DeliveryAgentAlert alert = deliveryAgentAlertRepository.findByIdAndAgentId(alertId, agent.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Reminder not found"));
        if (alert.getStatus() != DeliveryAgentAlertStatus.PENDING) {
            throw new BusinessException(ErrorCode.CONFLICT, "This reminder was already noticed");
        }
        alert.setStatus(DeliveryAgentAlertStatus.ACKNOWLEDGED);
        alert.setAcknowledgedBy(agentUserId);
        alert.setAcknowledgedAt(Instant.now());
        alert.setUpdatedAt(Instant.now());
        deliveryAgentAlertRepository.save(alert);
        return toResponseResolved(alert);
    }

    @Transactional(readOnly = true)
    public List<SubOrderAgentAlertSummaryResponse> summarizeForSubOrders(Collection<UUID> vendorSubOrderIds) {
        if (vendorSubOrderIds == null || vendorSubOrderIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, DeliveryAgentAlert> latest = new HashMap<>();
        for (DeliveryAgentAlert alert : deliveryAgentAlertRepository.findByVendorSubOrderIdInOrderByCreatedAtDesc(
                vendorSubOrderIds)) {
            latest.putIfAbsent(alert.getVendorSubOrderId(), alert);
        }
        List<SubOrderAgentAlertSummaryResponse> out = new ArrayList<>();
        for (UUID id : vendorSubOrderIds) {
            DeliveryAgentAlert alert = latest.get(id);
            if (alert == null) {
                continue;
            }
            out.add(SubOrderAgentAlertSummaryResponse.builder()
                    .vendorSubOrderId(id)
                    .alertId(alert.getId())
                    .status(alert.getStatus())
                    .acknowledgedAt(alert.getAcknowledgedAt())
                    .build());
        }
        return out;
    }

    private DeliveryAgentAlertResponse toResponseResolved(DeliveryAgentAlert alert) {
        OrderClient.SubOrderSnapshot sub = orderClient.getSubOrder(alert.getVendorSubOrderId());
        DeliveryAssignment assignment = deliveryAssignmentRepository.findById(alert.getAssignmentId()).orElse(null);
        return toResponse(alert, sub, assignment);
    }

    private static DeliveryAgentAlertResponse toResponse(
            DeliveryAgentAlert alert,
            OrderClient.SubOrderSnapshot sub,
            DeliveryAssignment assignment) {
        return DeliveryAgentAlertResponse.builder()
                .alertId(alert.getId())
                .assignmentId(alert.getAssignmentId())
                .orderId(alert.getOrderId())
                .orderNumber(sub == null ? null : sub.orderNumber())
                .vendorSubOrderId(alert.getVendorSubOrderId())
                .subOrderNumber(sub == null ? null : sub.subOrderNumber())
                .shopName(sub == null ? null : sub.shopName())
                .vendorId(alert.getVendorId())
                .agentId(alert.getAgentId())
                .status(alert.getStatus())
                .message(alert.getMessage())
                .createdAt(alert.getCreatedAt())
                .acknowledgedAt(alert.getAcknowledgedAt())
                .build();
    }
}

package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.NotificationClient;
import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.dto.request.AssignLastMileRequest;
import com.hyperlocalmart.delivery.dto.request.AssignPickupRequest;
import com.hyperlocalmart.delivery.dto.request.BuyerRejectedRequest;
import com.hyperlocalmart.delivery.dto.request.DeliverRequest;
import com.hyperlocalmart.delivery.dto.request.PickedFromVendorRequest;
import com.hyperlocalmart.delivery.dto.response.AssignmentResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AssignmentService {

    private static final String HUB_ADMIN_ACTIVE = "ACTIVE";
    private static final String READY_FOR_PICKUP = "READY_FOR_PICKUP";
    private static final String ORDER_PLACED = "PLACED";
    private static final List<AssignmentStatus> ACTIVE_STATUSES =
            List.of(AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS);

    private final HubAdminRepository hubAdminRepository;
    private final DeliveryHubRepository deliveryHubRepository;
    private final DeliveryAgentRepository deliveryAgentRepository;
    private final AgentHubLinkRepository agentHubLinkRepository;
    private final DeliveryAssignmentRepository deliveryAssignmentRepository;
    private final DeliveryEventRepository deliveryEventRepository;
    private final OrderClient orderClient;
    private final DeliveryOtpService deliveryOtpService;
    private final NotificationClient notificationClient;

    @Transactional
    public AssignmentResponse assignPickup(UUID hubAdminUserId, AssignPickupRequest request) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        DeliveryAgent agent = resolveActiveAgentLinkedToHub(request.getAgentId(), hubAdmin.getHubId());

        OrderClient.SubOrderSnapshot subOrder = orderClient.getSubOrder(request.getVendorSubOrderId());
        if (!READY_FOR_PICKUP.equals(subOrder.status())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Sub-order is not ready for pickup");
        }
        if (deliveryAssignmentRepository.existsByVendorSubOrderIdAndLegTypeAndStatusIn(
                request.getVendorSubOrderId(), AssignmentLegType.PICKUP, ACTIVE_STATUSES)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Active pickup assignment already exists for sub-order");
        }

        DeliveryHub hub = deliveryHubRepository.findById(hubAdmin.getHubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));
        if (!hub.getTownId().equals(subOrder.townId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Sub-order does not belong to hub town");
        }

        DeliveryAssignment assignment = DeliveryAssignment.builder()
                .orderId(subOrder.orderId())
                .vendorSubOrderId(subOrder.subOrderId())
                .townId(subOrder.townId())
                .hubId(hubAdmin.getHubId())
                .agentId(agent.getId())
                .legType(AssignmentLegType.PICKUP)
                .status(AssignmentStatus.ASSIGNED)
                .assignedBy(hubAdminUserId)
                .assignedAt(Instant.now())
                .build();
        assignment.setCreatedBy(hubAdminUserId);
        assignment.setUpdatedBy(hubAdminUserId);
        deliveryAssignmentRepository.save(assignment);

        logEvent(assignment.getId(), "PICKUP_ASSIGNED", hubAdminUserId, Map.of(
                "vendorSubOrderId", subOrder.subOrderId().toString(),
                "agentId", agent.getId().toString()
        ));

        return toResponse(assignment);
    }

    @Transactional
    public AssignmentResponse assignLastMile(UUID hubAdminUserId, AssignLastMileRequest request) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);
        DeliveryAgent agent = resolveActiveAgentLinkedToHub(request.getAgentId(), hubAdmin.getHubId());

        OrderClient.DeliveryOrderSnapshot order = orderClient.getDeliveryOrder(request.getOrderId());
        if (!ORDER_PLACED.equals(order.status())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order is not ready for last-mile delivery");
        }
        if (deliveryAssignmentRepository.existsByOrderIdAndLegTypeAndStatusIn(
                request.getOrderId(), AssignmentLegType.LAST_MILE, ACTIVE_STATUSES)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Active last-mile assignment already exists for order");
        }

        DeliveryHub hub = deliveryHubRepository.findById(hubAdmin.getHubId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub not found"));
        if (!hub.getTownId().equals(order.townId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Order does not belong to hub town");
        }

        DeliveryAssignment assignment = DeliveryAssignment.builder()
                .orderId(request.getOrderId())
                .townId(hub.getTownId())
                .hubId(hubAdmin.getHubId())
                .agentId(agent.getId())
                .legType(AssignmentLegType.LAST_MILE)
                .status(AssignmentStatus.ASSIGNED)
                .assignedBy(hubAdminUserId)
                .assignedAt(Instant.now())
                .build();
        assignment.setCreatedBy(hubAdminUserId);
        assignment.setUpdatedBy(hubAdminUserId);
        deliveryAssignmentRepository.save(assignment);

        String otp = deliveryOtpService.issueOtp(request.getOrderId());
        notificationClient.notifyOutForDelivery(
                order.townId(), order.orderId(), order.buyerId(), order.buyerPhone(),
                order.orderNumber(), otp);

        logEvent(assignment.getId(), "LAST_MILE_ASSIGNED", hubAdminUserId, Map.of(
                "orderId", request.getOrderId().toString(),
                "agentId", agent.getId().toString()
        ));

        return toResponse(assignment);
    }

    @Transactional(readOnly = true)
    public List<AssignmentResponse> listAgentAssignments(UUID agentUserId, AssignmentStatus status) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        List<DeliveryAssignment> assignments = status == null
                ? deliveryAssignmentRepository.findByAgentIdOrderByAssignedAtDesc(agent.getId())
                : deliveryAssignmentRepository.findByAgentIdAndStatusOrderByAssignedAtDesc(agent.getId(), status);

        return assignments.stream().map(this::toResponse).toList();
    }

    @Transactional
    public AssignmentResponse markPickedFromVendor(UUID agentUserId, UUID assignmentId, PickedFromVendorRequest request) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        DeliveryAssignment assignment = deliveryAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Assignment not found"));

        if (!assignment.getAgentId().equals(agent.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Assignment does not belong to agent");
        }
        if (assignment.getLegType() != AssignmentLegType.PICKUP) {
            throw new BusinessException(ErrorCode.CONFLICT, "Assignment is not a pickup leg");
        }
        if (assignment.getStatus() != AssignmentStatus.ASSIGNED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Assignment is not in ASSIGNED status");
        }

        assignment.setStatus(AssignmentStatus.IN_PROGRESS);
        assignment.setUpdatedBy(agentUserId);
        deliveryAssignmentRepository.save(assignment);

        Map<String, Object> metadata = new HashMap<>();
        if (request != null && request.getNote() != null && !request.getNote().isBlank()) {
            metadata.put("note", request.getNote());
        }
        logEvent(assignment.getId(), "PICKED_FROM_VENDOR", agentUserId, metadata);

        return toResponse(assignment);
    }

    @Transactional
    public AssignmentResponse markAtHub(UUID hubAdminUserId, UUID vendorSubOrderId) {
        resolveActiveHubAdmin(hubAdminUserId);

        DeliveryAssignment assignment = deliveryAssignmentRepository
                .findByVendorSubOrderIdAndLegTypeAndStatus(
                        vendorSubOrderId, AssignmentLegType.PICKUP, AssignmentStatus.IN_PROGRESS)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "In-progress pickup assignment not found"));

        assignment.setStatus(AssignmentStatus.COMPLETED);
        assignment.setCompletedAt(Instant.now());
        assignment.setUpdatedBy(hubAdminUserId);
        deliveryAssignmentRepository.save(assignment);

        logEvent(assignment.getId(), "BROUGHT_TO_HUB", hubAdminUserId, Map.of(
                "vendorSubOrderId", vendorSubOrderId.toString()
        ));

        return toResponse(assignment);
    }

    @Transactional
    public AssignmentResponse markPickedFromHub(UUID agentUserId, UUID assignmentId) {
        DeliveryAssignment assignment = loadAgentLastMileAssignment(agentUserId, assignmentId);
        if (assignment.getStatus() != AssignmentStatus.ASSIGNED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Assignment is not in ASSIGNED status");
        }

        assignment.setStatus(AssignmentStatus.IN_PROGRESS);
        assignment.setUpdatedBy(agentUserId);
        deliveryAssignmentRepository.save(assignment);
        logEvent(assignment.getId(), "PICKED_FROM_HUB", agentUserId, Map.of());

        return toResponse(assignment);
    }

    @Transactional
    public AssignmentResponse deliver(UUID agentUserId, UUID assignmentId, DeliverRequest request) {
        DeliveryAssignment assignment = loadAgentLastMileAssignment(agentUserId, assignmentId);
        if (assignment.getStatus() != AssignmentStatus.IN_PROGRESS) {
            throw new BusinessException(ErrorCode.CONFLICT, "Assignment is not in progress");
        }

        deliveryOtpService.verifyOtp(assignment.getOrderId(), request.getOtp());

        assignment.setStatus(AssignmentStatus.COMPLETED);
        assignment.setCompletedAt(Instant.now());
        assignment.setUpdatedBy(agentUserId);
        deliveryAssignmentRepository.save(assignment);

        Map<String, Object> metadata = new HashMap<>();
        if (request.getRecipientName() != null) {
            metadata.put("recipientName", request.getRecipientName());
        }
        if (request.getDeliveryPhotoMediaId() != null) {
            metadata.put("deliveryPhotoMediaId", request.getDeliveryPhotoMediaId());
        }
        logEvent(assignment.getId(), "DELIVERED", agentUserId, metadata);

        orderClient.markDelivered(assignment.getOrderId(), agentUserId, request.getRecipientName());
        return toResponse(assignment);
    }

    @Transactional
    public AssignmentResponse buyerRejected(UUID agentUserId, UUID assignmentId, BuyerRejectedRequest request) {
        DeliveryAssignment assignment = loadAgentLastMileAssignment(agentUserId, assignmentId);
        if (assignment.getStatus() != AssignmentStatus.IN_PROGRESS
                && assignment.getStatus() != AssignmentStatus.ASSIGNED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Assignment cannot be marked as buyer rejected");
        }

        assignment.setStatus(AssignmentStatus.CANCELLED);
        assignment.setUpdatedBy(agentUserId);
        deliveryAssignmentRepository.save(assignment);

        logEvent(assignment.getId(), "BUYER_REJECTED", agentUserId, Map.of("reason", request.getReason()));
        return toResponse(assignment);
    }

    @Transactional
    public String overrideOtp(UUID hubAdminUserId, UUID orderId, String reason) {
        resolveActiveHubAdmin(hubAdminUserId);
        OrderClient.DeliveryOrderSnapshot order = orderClient.getDeliveryOrder(orderId);
        String otp = deliveryOtpService.overrideOtp(orderId, hubAdminUserId, reason);
        notificationClient.notifyOutForDelivery(
                order.townId(), order.orderId(), order.buyerId(), order.buyerPhone(),
                order.orderNumber(), otp);
        return otp;
    }

    private DeliveryAssignment loadAgentLastMileAssignment(UUID agentUserId, UUID assignmentId) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        DeliveryAssignment assignment = deliveryAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Assignment not found"));

        if (!assignment.getAgentId().equals(agent.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Assignment does not belong to agent");
        }
        if (assignment.getLegType() != AssignmentLegType.LAST_MILE) {
            throw new BusinessException(ErrorCode.CONFLICT, "Assignment is not a last-mile leg");
        }
        return assignment;
    }

    private HubAdmin resolveActiveHubAdmin(UUID hubAdminUserId) {
        return hubAdminRepository.findByUserIdAndStatus(hubAdminUserId, HUB_ADMIN_ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "Active hub admin not found"));
    }

    private DeliveryAgent resolveActiveAgentLinkedToHub(UUID agentId, UUID hubId) {
        DeliveryAgent agent = deliveryAgentRepository.findById(agentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));
        if (agent.getStatus() != AgentStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.CONFLICT, "Delivery agent is not active");
        }
        if (!agentHubLinkRepository.existsByAgentIdAndHubIdAndActiveTrue(agentId, hubId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Agent is not linked to hub");
        }
        return agent;
    }

    private void logEvent(UUID assignmentId, String eventType, UUID createdBy, Map<String, Object> metadata) {
        DeliveryEvent event = DeliveryEvent.builder()
                .assignmentId(assignmentId)
                .eventType(eventType)
                .metadata(metadata == null || metadata.isEmpty() ? null : metadata)
                .createdBy(createdBy)
                .build();
        deliveryEventRepository.save(event);
    }

    private AssignmentResponse toResponse(DeliveryAssignment assignment) {
        return AssignmentResponse.builder()
                .assignmentId(assignment.getId())
                .orderId(assignment.getOrderId())
                .vendorSubOrderId(assignment.getVendorSubOrderId())
                .townId(assignment.getTownId())
                .hubId(assignment.getHubId())
                .agentId(assignment.getAgentId())
                .legType(assignment.getLegType())
                .status(assignment.getStatus())
                .assignedBy(assignment.getAssignedBy())
                .assignedAt(assignment.getAssignedAt())
                .completedAt(assignment.getCompletedAt())
                .build();
    }
}

package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.client.NotificationClient;
import com.hyperlocalmart.delivery.client.OrderClient;
import com.hyperlocalmart.delivery.client.VendorClient;
import com.hyperlocalmart.delivery.dto.request.ReassignAssignmentRequest;
import com.hyperlocalmart.delivery.dto.request.AssignLastMileRequest;
import com.hyperlocalmart.delivery.dto.request.AssignPickupRequest;
import com.hyperlocalmart.delivery.dto.request.BuyerRejectedRequest;
import com.hyperlocalmart.delivery.dto.request.DeliverRequest;
import com.hyperlocalmart.delivery.dto.request.PickedFromVendorRequest;
import com.hyperlocalmart.delivery.dto.response.AssignmentResponse;
import com.hyperlocalmart.delivery.dto.response.DeliveryEventResponse;
import com.hyperlocalmart.delivery.dto.response.DeliveryManifestLineResponse;
import com.hyperlocalmart.delivery.dto.response.DeliveryManifestResponse;
import com.hyperlocalmart.delivery.dto.response.PickupManifestLineResponse;
import com.hyperlocalmart.delivery.dto.response.PickupManifestResponse;
import com.hyperlocalmart.delivery.entity.*;
import com.hyperlocalmart.delivery.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final VendorClient vendorClient;
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
                .assignmentNumber(AssignmentNumberFormatter.pickup(subOrder.subOrderNumber()))
                .orderNumber(subOrder.orderNumber())
                .subOrderNumber(subOrder.subOrderNumber())
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
                .assignmentNumber(AssignmentNumberFormatter.lastMile(order.orderNumber()))
                .orderNumber(order.orderNumber())
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

    @Transactional
    public AssignmentResponse reassign(UUID hubAdminUserId, UUID assignmentId, ReassignAssignmentRequest request) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(hubAdminUserId);

        DeliveryAssignment assignment = deliveryAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Assignment not found"));

        if (!assignment.getHubId().equals(hubAdmin.getHubId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Assignment does not belong to your hub");
        }
        if (assignment.getStatus() != AssignmentStatus.ASSIGNED
                && assignment.getStatus() != AssignmentStatus.IN_PROGRESS) {
            throw new BusinessException(ErrorCode.CONFLICT, "Only active assignments can be reassigned");
        }
        if (assignment.getAgentId().equals(request.getNewAgentId())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "New agent must differ from current agent");
        }

        DeliveryAgent newAgent = resolveActiveAgentLinkedToHub(request.getNewAgentId(), hubAdmin.getHubId());
        UUID previousAgentId = assignment.getAgentId();
        String previousAgentName = deliveryAgentRepository.findById(previousAgentId)
                .map(DeliveryAgent::getName)
                .orElse("Previous boy");

        assignment.setAgentId(newAgent.getId());
        assignment.setAssignedBy(hubAdminUserId);
        assignment.setAssignedAt(Instant.now());
        assignment.setUpdatedBy(hubAdminUserId);
        deliveryAssignmentRepository.save(assignment);

        Map<String, Object> reassignMeta = new HashMap<>();
        reassignMeta.put("previousAgentId", previousAgentId.toString());
        reassignMeta.put("previousAgentName", previousAgentName);
        reassignMeta.put("newAgentId", newAgent.getId().toString());
        reassignMeta.put("newAgentName", newAgent.getName());
        reassignMeta.put("reason", request.getReason());
        logEvent(assignment.getId(), "REASSIGNED", hubAdminUserId, reassignMeta);

        return toResponse(assignment);
    }

    @Transactional(readOnly = true)
    public List<AssignmentResponse> listAgentAssignments(UUID agentUserId, AssignmentStatus status) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        List<DeliveryAssignment> assignments = status == null
                ? deliveryAssignmentRepository.findByAgentIdOrderByAssignedAtDesc(agent.getId())
                : deliveryAssignmentRepository.findByAgentIdAndStatusOrderByAssignedAtDesc(agent.getId(), status);

        return toResponseList(assignments);
    }

    @Transactional(readOnly = true)
    public PageResponse<AssignmentResponse> listAgentAssignmentsPaged(
            UUID agentUserId, String scope, int page, int size) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        Page<DeliveryAssignment> assignments;
        PageRequest pageable = PageRequest.of(page, size);
        String normalizedScope = scope == null ? "active" : scope.toLowerCase();
        if ("completed".equals(normalizedScope)) {
            assignments = deliveryAssignmentRepository.findByAgentIdAndStatusOrderByAssignedAtDesc(
                    agent.getId(), AssignmentStatus.COMPLETED, pageable);
        } else if ("all".equals(normalizedScope)) {
            assignments = deliveryAssignmentRepository.findByAgentIdOrderByAssignedAtDesc(agent.getId(), pageable);
        } else {
            assignments = deliveryAssignmentRepository.findByAgentIdAndStatusInOrderByAssignedAtDesc(
                    agent.getId(), Set.of(AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS), pageable);
        }

        List<AssignmentResponse> items = toResponseList(assignments.getContent());
        return PageResponse.<AssignmentResponse>builder()
                .items(items)
                .page(assignments.getNumber())
                .size(assignments.getSize())
                .totalElements(assignments.getTotalElements())
                .totalPages(assignments.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public PickupManifestResponse getPickupManifest(UUID agentUserId, UUID assignmentId) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        DeliveryAssignment assignment = deliveryAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Assignment not found"));

        if (!assignment.getAgentId().equals(agent.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Assignment does not belong to agent");
        }
        if (assignment.getLegType() != AssignmentLegType.PICKUP) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Pickup manifest is only for vendor pickup trips");
        }
        if (assignment.getVendorSubOrderId() == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Sub-order not linked to assignment");
        }

        OrderClient.PickupManifest manifest = orderClient.getPickupManifest(assignment.getVendorSubOrderId());
        String shopAddress = null;
        String shopPhone = null;
        if (manifest.shopId() != null) {
            try {
                VendorClient.ShopSnapshot shop = vendorClient.getShop(manifest.shopId());
                shopAddress = formatShopAddress(shop.address(), shop.pincode());
                shopPhone = shop.phone();
            } catch (RuntimeException ignored) {
                // Keep pickup usable even if vendor-service is briefly down.
            }
        }
        return PickupManifestResponse.builder()
                .assignmentId(assignment.getId())
                .subOrderId(manifest.subOrderId())
                .subOrderNumber(manifest.subOrderNumber())
                .orderNumber(manifest.orderNumber())
                .shopId(manifest.shopId())
                .shopName(manifest.shopName())
                .shopAddress(shopAddress)
                .shopPhone(shopPhone)
                .subtotal(manifest.subtotal())
                .totalItemCount(manifest.totalItemCount())
                .items(manifest.items().stream()
                        .map(line -> PickupManifestLineResponse.builder()
                                .name(line.name())
                                .quantity(line.quantity())
                                .unitCode(line.unitCode())
                                .lineTotal(line.lineTotal())
                                .build())
                        .toList())
                .build();
    }

    @Transactional(readOnly = true)
    public DeliveryManifestResponse getDeliveryManifest(UUID agentUserId, UUID assignmentId) {
        DeliveryAgent agent = deliveryAgentRepository.findByUserId(agentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found"));

        DeliveryAssignment assignment = deliveryAssignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Assignment not found"));

        if (!assignment.getAgentId().equals(agent.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Assignment does not belong to agent");
        }
        if (assignment.getLegType() != AssignmentLegType.LAST_MILE) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Delivery manifest is only for home delivery trips");
        }

        OrderClient.DeliveryManifest manifest = orderClient.getDeliveryManifest(assignment.getOrderId());
        return DeliveryManifestResponse.builder()
                .assignmentId(assignment.getId())
                .orderId(manifest.orderId())
                .orderNumber(manifest.orderNumber())
                .subtotal(manifest.subtotal())
                .totalItemCount(manifest.totalItemCount())
                .items(manifest.items().stream()
                        .map(line -> DeliveryManifestLineResponse.builder()
                                .shopName(line.shopName())
                                .name(line.name())
                                .quantity(line.quantity())
                                .unitCode(line.unitCode())
                                .lineTotal(line.lineTotal())
                                .build())
                        .toList())
                .build();
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

        try {
            OrderClient.DeliveryOrderSnapshot order = orderClient.getDeliveryOrder(assignment.getOrderId());
            notificationClient.notifyOrderAtHub(
                    order.townId(), order.orderId(), order.buyerId(), order.buyerPhone(), order.orderNumber());
        } catch (RuntimeException ex) {
            // Non-blocking: hub intake still succeeds if notify fails.
        }

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
        assignment.setCompletedAt(Instant.now());
        assignment.setUpdatedBy(agentUserId);
        deliveryAssignmentRepository.save(assignment);

        logEvent(assignment.getId(), "BUYER_REJECTED", agentUserId, Map.of("reason", request.getReason()));

        try {
            OrderClient.DeliveryOrderSnapshot order = orderClient.getDeliveryOrder(assignment.getOrderId());
            notificationClient.notifyBuyerRejected(
                    order.townId(),
                    order.orderId(),
                    order.buyerId(),
                    order.buyerPhone(),
                    order.orderNumber(),
                    request.getReason());
        } catch (RuntimeException ex) {
            // Non-blocking: rejection still recorded if notify fails.
        }

        return toResponse(assignment);
    }

    @Transactional
    public String overrideOtp(UUID hubAdminUserId, UUID orderId, String reason) {
        resolveActiveHubAdmin(hubAdminUserId);
        OrderClient.DeliveryOrderSnapshot order = orderClient.getDeliveryOrder(orderId);
        String otp = deliveryOtpService.overrideOtp(orderId, hubAdminUserId, reason);
        deliveryAssignmentRepository.findByOrderIdOrderByAssignedAtDesc(orderId).stream()
                .filter(a -> a.getLegType() == AssignmentLegType.LAST_MILE)
                .filter(a -> a.getStatus() == AssignmentStatus.ASSIGNED || a.getStatus() == AssignmentStatus.IN_PROGRESS)
                .findFirst()
                .ifPresent(a -> logEvent(a.getId(), "OTP_OVERRIDE", hubAdminUserId,
                        Map.of("reason", reason == null ? "" : reason)));
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

    private List<AssignmentResponse> toResponseList(List<DeliveryAssignment> assignments) {
        Map<UUID, List<DeliveryEventResponse>> eventsByAssignment = loadEventResponses(assignments.stream()
                .map(DeliveryAssignment::getId)
                .toList());
        Map<UUID, OrderClient.DeliveryOrderSnapshot> deliveryByOrder = new HashMap<>();
        for (DeliveryAssignment assignment : assignments) {
            if (assignment.getLegType() != AssignmentLegType.LAST_MILE) {
                continue;
            }
            deliveryByOrder.computeIfAbsent(assignment.getOrderId(), orderId -> {
                try {
                    return orderClient.getDeliveryOrder(orderId);
                } catch (RuntimeException ex) {
                    return null;
                }
            });
        }
        return assignments.stream()
                .map(a -> toResponse(
                        a,
                        eventsByAssignment.getOrDefault(a.getId(), List.of()),
                        deliveryByOrder.get(a.getOrderId())))
                .toList();
    }

    private AssignmentResponse toResponse(DeliveryAssignment assignment) {
        List<DeliveryEventResponse> events = loadEventResponses(List.of(assignment.getId()))
                .getOrDefault(assignment.getId(), List.of());
        OrderClient.DeliveryOrderSnapshot delivery = null;
        if (assignment.getLegType() == AssignmentLegType.LAST_MILE) {
            try {
                delivery = orderClient.getDeliveryOrder(assignment.getOrderId());
            } catch (RuntimeException ignored) {
                // Leave destination blank if order-service is unavailable.
            }
        }
        return toResponse(assignment, events, delivery);
    }

    private AssignmentResponse toResponse(
            DeliveryAssignment assignment,
            List<DeliveryEventResponse> events,
            OrderClient.DeliveryOrderSnapshot delivery) {
        String destinationLabel = null;
        String destinationName = null;
        String destinationPhone = null;
        String destinationAddress = null;
        if (assignment.getLegType() == AssignmentLegType.LAST_MILE && delivery != null) {
            destinationLabel = delivery.addressLabel();
            destinationName = delivery.recipientName();
            destinationPhone = firstNonBlank(delivery.recipientPhone(), delivery.buyerPhone());
            destinationAddress = formatBuyerAddress(
                    delivery.addressLine1(),
                    delivery.addressLine2(),
                    delivery.landmark(),
                    delivery.pincode());
        }
        return AssignmentResponse.builder()
                .assignmentId(assignment.getId())
                .assignmentNumber(assignment.getAssignmentNumber())
                .orderId(assignment.getOrderId())
                .orderNumber(assignment.getOrderNumber())
                .vendorSubOrderId(assignment.getVendorSubOrderId())
                .subOrderNumber(assignment.getSubOrderNumber())
                .townId(assignment.getTownId())
                .hubId(assignment.getHubId())
                .agentId(assignment.getAgentId())
                .legType(assignment.getLegType())
                .status(assignment.getStatus())
                .assignedBy(assignment.getAssignedBy())
                .assignedAt(assignment.getAssignedAt())
                .startedAt(deriveStartedAt(events))
                .completedAt(assignment.getCompletedAt())
                .events(events)
                .destinationLabel(destinationLabel)
                .destinationName(destinationName)
                .destinationPhone(destinationPhone)
                .destinationAddress(destinationAddress)
                .build();
    }

    private static String formatShopAddress(String address, String pincode) {
        String line = address == null ? "" : address.trim();
        String pin = pincode == null ? "" : pincode.trim();
        if (line.isEmpty() && pin.isEmpty()) {
            return null;
        }
        if (line.isEmpty()) {
            return pin;
        }
        if (pin.isEmpty()) {
            return line;
        }
        return line + ", " + pin;
    }

    private static String formatBuyerAddress(String line1, String line2, String landmark, String pincode) {
        StringBuilder sb = new StringBuilder();
        appendPart(sb, line1);
        appendPart(sb, line2);
        if (landmark != null && !landmark.isBlank()) {
            appendPart(sb, "Near " + landmark.trim());
        }
        appendPart(sb, pincode);
        return sb.isEmpty() ? null : sb.toString();
    }

    private static void appendPart(StringBuilder sb, String part) {
        if (part == null || part.isBlank()) {
            return;
        }
        if (!sb.isEmpty()) {
            sb.append(", ");
        }
        sb.append(part.trim());
    }

    private static String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary.trim();
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback.trim();
        }
        return null;
    }

    private Map<UUID, List<DeliveryEventResponse>> loadEventResponses(List<UUID> assignmentIds) {
        if (assignmentIds == null || assignmentIds.isEmpty()) {
            return Map.of();
        }
        return deliveryEventRepository.findByAssignmentIdInOrderByCreatedAtAsc(assignmentIds).stream()
                .collect(Collectors.groupingBy(
                        DeliveryEvent::getAssignmentId,
                        Collectors.mapping(this::toEventResponse, Collectors.toList())));
    }

    private DeliveryEventResponse toEventResponse(DeliveryEvent event) {
        return DeliveryEventResponse.builder()
                .eventId(event.getId())
                .eventType(event.getEventType())
                .createdAt(event.getCreatedAt())
                .createdBy(event.getCreatedBy())
                .metadata(event.getMetadata())
                .build();
    }

    private Instant deriveStartedAt(List<DeliveryEventResponse> events) {
        return events.stream()
                .filter(e -> e.getEventType() != null && e.getEventType().startsWith("PICKED_"))
                .map(DeliveryEventResponse::getCreatedAt)
                .findFirst()
                .orElse(null);
    }
}

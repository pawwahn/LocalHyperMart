package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminAssignmentEventResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminAssignmentHintResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminAssignmentResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderDetailResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderSummaryResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminSubOrderItemResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminSubOrderResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminVendorAlertResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.VendorOrderAlert;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.VendorOrderAlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderAdminService {

    private final OrderRepository orderRepository;
    private final DeliveryClient deliveryClient;
    private final VendorOrderAlertRepository vendorOrderAlertRepository;

    @Transactional(readOnly = true)
    public PageResponse<AdminOrderSummaryResponse> listAdminOrders(
            UUID actorUserId,
            List<String> roles,
            UUID townId,
            UUID buyerId,
            OrderStatus status,
            String q,
            int page,
            int size) {
        if (buyerId != null) {
            if (!roles.contains("SUPER_ADMIN")) {
                if (townId == null) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "townId is required");
                }
                validateTownAccess(actorUserId, roles, townId);
            } else if (townId != null) {
                validateTownAccess(actorUserId, roles, townId);
            }
        } else {
            if (townId == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "townId is required");
            }
            validateTownAccess(actorUserId, roles, townId);
        }

        PageRequest pageable = PageRequest.of(page, Math.min(Math.max(size, 1), 50));
        String query = q == null ? null : q.trim();
        Page<Order> orders;
        if (buyerId != null) {
            // Customer console: full buyer history (optional town scope). Status/q ignored here.
            orders = townId == null
                    ? orderRepository.findByBuyerIdOrderByCreatedAtDesc(buyerId, pageable)
                    : orderRepository.findByBuyerIdAndTownIdOrderByCreatedAtDesc(buyerId, townId, pageable);
        } else if ((query == null || query.isEmpty()) && status == null) {
            orders = orderRepository.findByTownIdOrderByCreatedAtDesc(townId, pageable);
        } else if (query == null || query.isEmpty()) {
            orders = orderRepository.findByTownIdAndStatusOrderByCreatedAtDesc(townId, status, pageable);
        } else {
            orders = orderRepository.searchAdminByTown(townId, status, query, pageable);
        }

        List<AdminOrderSummaryResponse> items = orders.getContent().stream()
                .map(this::toSummary)
                .toList();

        return PageResponse.<AdminOrderSummaryResponse>builder()
                .items(items)
                .page(orders.getNumber())
                .size(orders.getSize())
                .totalElements(orders.getTotalElements())
                .totalPages(orders.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public AdminOrderDetailResponse getAdminOrder(UUID actorUserId, List<String> roles, UUID orderId, UUID townId) {
        validateTownAccess(actorUserId, roles, townId);

        Order order = orderRepository.findAdminDetailById(orderId)
                .filter(o -> o.getTownId().equals(townId))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));

        List<VendorSubOrder> bags = order.getVendorSubOrders() == null
                ? List.of()
                : order.getVendorSubOrders();
        Map<UUID, VendorOrderAlert> latestAlertBySub = latestAlertsBySubOrder(bags);
        List<AdminSubOrderResponse> subOrders = bags.stream()
                .map(sub -> toSubOrder(sub, latestAlertBySub.get(sub.getId())))
                .toList();

        List<AdminAssignmentResponse> assignments = deliveryClient.getAssignmentsForOrder(orderId).stream()
                .map(a -> AdminAssignmentResponse.builder()
                        .assignmentId(a.assignmentId())
                        .assignmentNumber(a.assignmentNumber())
                        .orderNumber(a.orderNumber())
                        .subOrderNumber(a.subOrderNumber())
                        .agentId(a.agentId())
                        .agentName(a.agentName())
                        .agentPhone(a.agentPhone())
                        .legType(a.legType())
                        .status(a.status())
                        .assignedAt(a.assignedAt())
                        .startedAt(a.startedAt())
                        .completedAt(a.completedAt())
                        .events(a.events() == null ? List.of() : a.events().stream()
                                .map(e -> AdminAssignmentEventResponse.builder()
                                        .eventId(e.eventId())
                                        .eventType(e.eventType())
                                        .createdAt(e.createdAt())
                                        .createdBy(e.createdBy())
                                        .metadata(e.metadata())
                                        .build())
                                .toList())
                        .build())
                .toList();

        return AdminOrderDetailResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .townId(order.getTownId())
                .buyerId(order.getBuyerId())
                .buyerPhone(order.getBuyerPhoneSnapshot())
                .recipientName(stringFromAddress(order.getDeliveryAddressSnapshot(), "recipientName"))
                .deliveryAddress(formatAddress(order.getDeliveryAddressSnapshot()))
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .itemsSubtotal(order.getItemsSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .storeCreditApplied(order.getStoreCreditApplied())
                .promoDiscount(order.getPromoDiscount())
                .promoCode(order.getPromoCode())
                .totalAmount(order.getTotalAmount())
                .placedAt(order.getPlacedAt())
                .deliveredAt(order.getDeliveredAt())
                .cancelledAt(order.getCancelledAt())
                .cancelReason(order.getCancelReason())
                .subOrders(subOrders)
                .assignments(assignments)
                .build();
    }

    private static String stringFromAddress(Map<String, Object> address, String key) {
        if (address == null || address.get(key) == null) {
            return null;
        }
        String value = String.valueOf(address.get(key)).trim();
        return value.isEmpty() || "null".equalsIgnoreCase(value) ? null : value;
    }

    private static String formatAddress(Map<String, Object> address) {
        if (address == null || address.isEmpty()) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        for (String key : List.of("line1", "line2", "landmark", "pincode")) {
            String value = stringFromAddress(address, key);
            if (value != null) {
                parts.add(value);
            }
        }
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private void validateTownAccess(UUID actorUserId, List<String> roles, UUID townId) {
        if (roles.contains("SUPER_ADMIN")) {
            return;
        }
        if (!roles.contains("HUB_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or super admin role required");
        }
        DeliveryClient.HubAdminContext context = deliveryClient.getHubAdminContext(actorUserId);
        if (!context.townId().equals(townId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Order town does not match hub scope");
        }
    }

    private AdminOrderSummaryResponse toSummary(Order order) {
        List<VendorSubOrder> allSubs = order.getVendorSubOrders() == null
                ? List.of()
                : order.getVendorSubOrders();
        List<VendorSubOrder> activeSubs = allSubs.stream()
                .filter(sub -> sub.getStatus() != VendorSubOrderStatus.VENDOR_REJECTED)
                .toList();
        int rejectedSubOrderCount = allSubs.size() - activeSubs.size();
        int readySubOrderCount = (int) activeSubs.stream()
                .filter(sub -> sub.getStatus() == VendorSubOrderStatus.READY_FOR_PICKUP)
                .count();
        int atHubFromStatus = (int) activeSubs.stream()
                .filter(sub -> sub.getStatus() == VendorSubOrderStatus.DELIVERED)
                .count();
        List<DeliveryClient.OrderAssignment> assignments = order.getStatus() == OrderStatus.PLACED
                ? deliveryClient.getAssignmentsForOrder(order.getId())
                : List.of();
        int atHubSubOrderCount = atHubFromStatus;
        if (order.getStatus() == OrderStatus.PLACED && atHubFromStatus < activeSubs.size() && !activeSubs.isEmpty()) {
            var activeNumbers = activeSubs.stream()
                    .map(VendorSubOrder::getSubOrderNumber)
                    .filter(n -> n != null && !n.isBlank())
                    .collect(java.util.stream.Collectors.toSet());
            long completedPickups = assignments.stream()
                    .filter(a -> "PICKUP".equalsIgnoreCase(a.legType())
                            && "COMPLETED".equalsIgnoreCase(a.status())
                            && a.subOrderNumber() != null
                            && activeNumbers.contains(a.subOrderNumber()))
                    .count();
            atHubSubOrderCount = (int) Math.max(atHubFromStatus, Math.min(completedPickups, activeSubs.size()));
            readySubOrderCount = Math.max(0, readySubOrderCount - Math.min(readySubOrderCount, atHubSubOrderCount));
        }
        List<AdminAssignmentHintResponse> assignmentHints = assignments.stream()
                .map(a -> AdminAssignmentHintResponse.builder()
                        .legType(a.legType())
                        .status(a.status())
                        .subOrderNumber(a.subOrderNumber())
                        .build())
                .toList();
        return AdminOrderSummaryResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .townId(order.getTownId())
                .buyerId(order.getBuyerId())
                .buyerPhone(order.getBuyerPhoneSnapshot())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .totalAmount(order.getTotalAmount())
                .placedAt(order.getPlacedAt())
                .subOrderCount(activeSubs.size())
                .rejectedSubOrderCount(rejectedSubOrderCount)
                .readySubOrderCount(readySubOrderCount)
                .atHubSubOrderCount(atHubSubOrderCount)
                .assignments(assignmentHints)
                .build();
    }

    private Map<UUID, VendorOrderAlert> latestAlertsBySubOrder(List<VendorSubOrder> subs) {
        if (subs == null || subs.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = subs.stream().map(VendorSubOrder::getId).toList();
        Map<UUID, VendorOrderAlert> latest = new HashMap<>();
        for (VendorOrderAlert alert : vendorOrderAlertRepository.findByVendorSubOrderIdInOrderByCreatedAtDesc(ids)) {
            latest.putIfAbsent(alert.getVendorSubOrderId(), alert);
        }
        return latest;
    }

    private AdminSubOrderResponse toSubOrder(VendorSubOrder subOrder, VendorOrderAlert alert) {
        // Admin needs full picture — include cancelled/restored lines.
        List<OrderItem> items = subOrder.getItems() == null ? List.of() : subOrder.getItems();
        int itemCount = items.stream().mapToInt(OrderItem::getQuantity).sum();
        String shopName = items.isEmpty() ? "Shop" : items.getFirst().getShopNameSnapshot();
        List<AdminSubOrderItemResponse> itemResponses = items.stream()
                .map(item -> AdminSubOrderItemResponse.builder()
                        .name(item.getItemNameSnapshot())
                        .unitCode(item.getUnitCodeSnapshot())
                        .quantity(item.getQuantity())
                        .lineTotal(item.getLineTotal())
                        .status(item.getStatus() == null ? OrderItemStatus.ACTIVE.name() : item.getStatus().name())
                        .build())
                .toList();
        AdminVendorAlertResponse vendorAlert = alert == null ? null : AdminVendorAlertResponse.builder()
                .alertId(alert.getId())
                .status(alert.getStatus() == null ? null : alert.getStatus().name())
                .message(alert.getMessage())
                .createdAt(alert.getCreatedAt())
                .acknowledgedAt(alert.getAcknowledgedAt())
                .build();
        return AdminSubOrderResponse.builder()
                .subOrderId(subOrder.getId())
                .subOrderNumber(subOrder.getSubOrderNumber())
                .vendorId(subOrder.getVendorId())
                .shopId(subOrder.getShopId())
                .shopName(shopName != null && !shopName.isBlank() ? shopName : "Shop")
                .status(subOrder.getStatus())
                .subtotal(subOrder.getSubtotal())
                .readyForPickupAt(subOrder.getReadyForPickupAt())
                .itemCount(itemCount)
                .items(itemResponses)
                .vendorAlert(vendorAlert)
                .build();
    }
}

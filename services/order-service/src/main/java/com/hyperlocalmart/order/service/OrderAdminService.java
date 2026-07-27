package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminAssignmentEventResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminAssignmentResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderDetailResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderSummaryResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminSubOrderItemResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminSubOrderResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderAdminService {

    private final OrderRepository orderRepository;
    private final DeliveryClient deliveryClient;

    @Transactional(readOnly = true)
    public PageResponse<AdminOrderSummaryResponse> listAdminOrders(
            UUID actorUserId,
            List<String> roles,
            UUID townId,
            OrderStatus status,
            String q,
            int page,
            int size) {
        validateTownAccess(actorUserId, roles, townId);

        PageRequest pageable = PageRequest.of(page, size);
        String query = q == null ? null : q.trim();
        Page<Order> orders = (query == null || query.isEmpty()) && status == null
                ? orderRepository.findByTownIdOrderByCreatedAtDesc(townId, pageable)
                : (query == null || query.isEmpty())
                        ? orderRepository.findByTownIdAndStatusOrderByCreatedAtDesc(townId, status, pageable)
                        : orderRepository.searchAdminByTown(townId, status, query, pageable);

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

        List<AdminSubOrderResponse> subOrders = order.getVendorSubOrders().stream()
                .map(this::toSubOrder)
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
        int readySubOrderCount = (int) order.getVendorSubOrders().stream()
                .filter(sub -> sub.getStatus() == VendorSubOrderStatus.READY_FOR_PICKUP)
                .count();
        return AdminOrderSummaryResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .buyerId(order.getBuyerId())
                .buyerPhone(order.getBuyerPhoneSnapshot())
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .totalAmount(order.getTotalAmount())
                .placedAt(order.getPlacedAt())
                .subOrderCount(order.getVendorSubOrders().size())
                .readySubOrderCount(readySubOrderCount)
                .build();
    }

    private AdminSubOrderResponse toSubOrder(VendorSubOrder subOrder) {
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
                .build();
    }
}

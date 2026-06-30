package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminAssignmentResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderDetailResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderSummaryResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminSubOrderResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderAdminService {

    private final OrderRepository orderRepository;
    private final DeliveryClient deliveryClient;

    @Transactional(readOnly = true)
    public PageResponse<AdminOrderSummaryResponse> listAdminOrders(
            UUID actorUserId, List<String> roles, UUID townId, OrderStatus status, int page, int size) {
        validateTownAccess(actorUserId, roles, townId);

        PageRequest pageable = PageRequest.of(page, size);
        Page<Order> orders = status == null
                ? orderRepository.findByTownIdOrderByCreatedAtDesc(townId, pageable)
                : orderRepository.findByTownIdAndStatusOrderByCreatedAtDesc(townId, status, pageable);

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
                        .agentId(a.agentId())
                        .legType(a.legType())
                        .status(a.status())
                        .assignedAt(a.assignedAt())
                        .completedAt(a.completedAt())
                        .build())
                .toList();

        return AdminOrderDetailResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .townId(order.getTownId())
                .buyerId(order.getBuyerId())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .totalAmount(order.getTotalAmount())
                .placedAt(order.getPlacedAt())
                .deliveredAt(order.getDeliveredAt())
                .cancelledAt(order.getCancelledAt())
                .subOrders(subOrders)
                .assignments(assignments)
                .build();
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
        return AdminOrderSummaryResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .buyerId(order.getBuyerId())
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .totalAmount(order.getTotalAmount())
                .placedAt(order.getPlacedAt())
                .subOrderCount(order.getVendorSubOrders().size())
                .build();
    }

    private AdminSubOrderResponse toSubOrder(VendorSubOrder subOrder) {
        int itemCount = subOrder.getItems().stream().mapToInt(OrderItem::getQuantity).sum();
        return AdminSubOrderResponse.builder()
                .subOrderId(subOrder.getId())
                .vendorId(subOrder.getVendorId())
                .shopId(subOrder.getShopId())
                .status(subOrder.getStatus())
                .subtotal(subOrder.getSubtotal())
                .readyForPickupAt(subOrder.getReadyForPickupAt())
                .itemCount(itemCount)
                .build();
    }
}

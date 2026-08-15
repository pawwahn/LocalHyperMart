package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.dto.request.CreateVendorOrderAlertRequest;
import com.hyperlocalmart.order.dto.response.VendorOrderAlertResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.VendorOrderAlert;
import com.hyperlocalmart.order.entity.VendorOrderAlertStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.VendorOrderAlertRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorOrderAlertService {

    private final VendorOrderAlertRepository vendorOrderAlertRepository;
    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final DeliveryClient deliveryClient;

    @Transactional
    public VendorOrderAlertResponse createAlert(
            UUID actorUserId,
            List<String> roles,
            UUID subOrderId,
            UUID townId,
            CreateVendorOrderAlertRequest request) {
        validateTownAccess(actorUserId, roles, townId);

        VendorSubOrder sub = vendorSubOrderRepository.findDetailedByIdWithItems(subOrderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Shop bag not found"));
        Order order = sub.getOrder();
        if (order == null || !townId.equals(order.getTownId())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Shop bag not found");
        }
        if (sub.getStatus() != VendorSubOrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Alert vendor only while the shop is still packing");
        }
        if (vendorOrderAlertRepository.existsByVendorSubOrderIdAndStatus(
                sub.getId(), VendorOrderAlertStatus.PENDING)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "A reminder is already ringing for this shop. Wait until they tap Noticed order.");
        }

        String message = request == null || request.getMessage() == null || request.getMessage().isBlank()
                ? null
                : request.getMessage().trim();

        VendorOrderAlert alert = VendorOrderAlert.builder()
                .orderId(order.getId())
                .vendorSubOrderId(sub.getId())
                .vendorId(sub.getVendorId())
                .shopId(sub.getShopId())
                .townId(order.getTownId())
                .status(VendorOrderAlertStatus.PENDING)
                .message(message)
                .createdBy(actorUserId)
                .build();
        alert = vendorOrderAlertRepository.save(alert);
        return toResponse(alert, order, sub);
    }

    @Transactional(readOnly = true)
    public List<VendorOrderAlertResponse> listPendingForVendor(UUID vendorId) {
        return vendorOrderAlertRepository
                .findByVendorIdAndStatusOrderByCreatedAtDesc(vendorId, VendorOrderAlertStatus.PENDING)
                .stream()
                .map(alert -> {
                    VendorSubOrder sub = vendorSubOrderRepository.findDetailedByIdWithItems(alert.getVendorSubOrderId())
                            .orElse(null);
                    Order order = sub == null ? null : sub.getOrder();
                    return toResponse(alert, order, sub);
                })
                .toList();
    }

    @Transactional
    public VendorOrderAlertResponse acknowledge(UUID vendorId, UUID alertId, UUID actorUserId) {
        VendorOrderAlert alert = vendorOrderAlertRepository.findByIdAndVendorId(alertId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Reminder not found"));
        if (alert.getStatus() != VendorOrderAlertStatus.PENDING) {
            throw new BusinessException(ErrorCode.CONFLICT, "This reminder was already noticed");
        }
        alert.setStatus(VendorOrderAlertStatus.ACKNOWLEDGED);
        alert.setAcknowledgedBy(actorUserId);
        alert.setAcknowledgedAt(Instant.now());
        alert.setUpdatedAt(Instant.now());
        vendorOrderAlertRepository.save(alert);

        VendorSubOrder sub = vendorSubOrderRepository.findDetailedById(alert.getVendorSubOrderId()).orElse(null);
        Order order = sub == null ? null : sub.getOrder();
        return toResponse(alert, order, sub);
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

    private static VendorOrderAlertResponse toResponse(
            VendorOrderAlert alert, Order order, VendorSubOrder sub) {
        String shopName = "Shop";
        if (sub != null && sub.getItems() != null && !sub.getItems().isEmpty()) {
            OrderItem first = sub.getItems().getFirst();
            if (first.getShopNameSnapshot() != null && !first.getShopNameSnapshot().isBlank()) {
                shopName = first.getShopNameSnapshot();
            }
        }
        return VendorOrderAlertResponse.builder()
                .alertId(alert.getId())
                .orderId(alert.getOrderId())
                .orderNumber(order == null ? null : order.getOrderNumber())
                .subOrderId(alert.getVendorSubOrderId())
                .subOrderNumber(sub == null ? null : sub.getSubOrderNumber())
                .vendorId(alert.getVendorId())
                .shopId(alert.getShopId())
                .shopName(shopName)
                .townId(alert.getTownId())
                .status(alert.getStatus())
                .message(alert.getMessage())
                .createdAt(alert.getCreatedAt())
                .acknowledgedAt(alert.getAcknowledgedAt())
                .build();
    }
}

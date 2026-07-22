package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.dto.request.CreateClaimRequest;
import com.hyperlocalmart.order.dto.request.ResolveClaimRequest;
import com.hyperlocalmart.order.dto.response.ClaimResponse;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderClaimRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Wave A #4 — post-delivery claims (missing / wrong / damaged).
 * Buyer files → hub resolves with store credit (COD + ONLINE) or rejects.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderClaimService {

    /** Pilot window: buyer may file within 7 days of delivery. */
    public static final Duration CLAIM_WINDOW = Duration.ofDays(7);

    private final OrderClaimRepository orderClaimRepository;
    private final OrderRepository orderRepository;
    private final PaymentClient paymentClient;
    private final NotificationClient notificationClient;
    private final DeliveryClient deliveryClient;

    @Transactional
    public ClaimResponse createClaim(UUID buyerId, UUID orderId, CreateClaimRequest request) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));

        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Claims can only be filed after delivery");
        }
        if (!withinClaimWindow(order)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Claim window has closed (7 days after delivery)");
        }

        OrderItem item = findItem(order, request.getOrderItemId());
        OrderItemStatus st = item.getStatus() == null ? OrderItemStatus.ACTIVE : item.getStatus();
        if (st == OrderItemStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cannot claim a cancelled item");
        }
        if (orderClaimRepository.existsByOrderIdAndOrderItemIdAndStatus(
                orderId, item.getId(), ClaimStatus.OPEN)) {
            throw new BusinessException(ErrorCode.CONFLICT, "An open claim already exists for this item");
        }
        if (orderClaimRepository.existsByOrderIdAndOrderItemIdAndStatus(
                orderId, item.getId(), ClaimStatus.RESOLVED)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "This item already has a resolved claim. Contact the hub if you need more help.");
        }

        OrderClaim claim = OrderClaim.builder()
                .orderId(order.getId())
                .orderItemId(item.getId())
                .buyerId(buyerId)
                .townId(order.getTownId())
                .claimType(request.getClaimType())
                .status(ClaimStatus.OPEN)
                .reason(request.getReason().trim())
                .build();
        claim = orderClaimRepository.save(claim);

        try {
            notificationClient.notifyClaimOpened(
                    order.getTownId(),
                    order.getId(),
                    order.getBuyerId(),
                    order.getBuyerPhoneSnapshot(),
                    order.getOrderNumber(),
                    request.getClaimType().name(),
                    item.getItemNameSnapshot());
        } catch (RuntimeException ex) {
            log.warn("Claim opened notification failed for {}: {}", claim.getId(), ex.toString());
        }

        return toResponse(claim, order, item);
    }

    @Transactional(readOnly = true)
    public List<ClaimResponse> listBuyerClaims(UUID buyerId, UUID orderId) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        return orderClaimRepository.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .map(c -> toResponse(c, order, findItemOrNull(order, c.getOrderItemId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<ClaimResponse> listHubClaims(
            UUID actorUserId, List<String> roles, UUID townId, ClaimStatus status, int page, int size) {
        validateTownAccess(actorUserId, roles, townId);
        PageRequest pageable = PageRequest.of(page, size);
        Page<OrderClaim> results = status == null
                ? orderClaimRepository.findByTownIdOrderByCreatedAtDesc(townId, pageable)
                : orderClaimRepository.findByTownIdAndStatusOrderByCreatedAtDesc(townId, status, pageable);

        List<ClaimResponse> items = results.getContent().stream()
                .map(c -> {
                    Order order = orderRepository.findAdminDetailById(c.getOrderId()).orElse(null);
                    OrderItem item = order != null ? findItemOrNull(order, c.getOrderItemId()) : null;
                    return toResponse(c, order, item);
                })
                .toList();

        return PageResponse.<ClaimResponse>builder()
                .items(items)
                .page(results.getNumber())
                .size(results.getSize())
                .totalElements(results.getTotalElements())
                .totalPages(results.getTotalPages())
                .build();
    }

    @Transactional
    public ClaimResponse resolveClaim(
            UUID actorUserId, List<String> roles, UUID claimId, UUID townId, ResolveClaimRequest request) {
        validateTownAccess(actorUserId, roles, townId);

        OrderClaim claim = orderClaimRepository.findByIdAndTownId(claimId, townId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Claim not found"));
        if (claim.getStatus() != ClaimStatus.OPEN) {
            throw new BusinessException(ErrorCode.CONFLICT, "Claim is already closed");
        }

        Order order = orderRepository.findAdminDetailById(claim.getOrderId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        OrderItem item = findItemOrNull(order, claim.getOrderItemId());

        ClaimResolution resolution = request.getResolution();
        if (resolution == ClaimResolution.WALLET_CREDIT) {
            BigDecimal amount = request.getAmount();
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Credit amount is required");
            }
            if (item == null || item.getLineTotal() == null) {
                throw new BusinessException(ErrorCode.CONFLICT, "Claim item is missing — cannot credit");
            }
            if (amount.compareTo(item.getLineTotal()) > 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Credit cannot exceed the item line total (₹" + item.getLineTotal().toPlainString() + ")");
            }

            try {
                paymentClient.creditWallet(
                        order.getBuyerId(),
                        amount,
                        "ORDER_CLAIM_CREDIT",
                        claim.getId(),
                        order.getId(),
                        claim.getOrderItemId(),
                        "Claim " + claim.getClaimType().name() + ": " + claim.getReason());
            } catch (RuntimeException ex) {
                log.error("Wallet credit failed for claim {}", claimId, ex);
                throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                        "Could not credit buyer wallet. Try again in a moment.");
            }

            VendorSubOrder sub = item.getVendorSubOrder();
            if (sub == null || sub.getVendorId() == null) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                        "Claim item has no vendor — cannot record payout debit");
            }
            try {
                paymentClient.recordVendorClaimChargeback(
                        order.getTownId(),
                        sub.getVendorId(),
                        sub.getShopId(),
                        claim.getId(),
                        order.getId(),
                        order.getOrderNumber(),
                        item.getId(),
                        sub.getId(),
                        amount,
                        buildVendorChargebackReason(claim, item.getItemNameSnapshot(), amount));
            } catch (RuntimeException ex) {
                log.error("Vendor chargeback failed for claim {}", claimId, ex);
                throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                        "Buyer credit succeeded but vendor payout debit failed. Retry resolve.");
            }

            claim.setStatus(ClaimStatus.RESOLVED);
            claim.setResolution(ClaimResolution.WALLET_CREDIT);
            claim.setResolvedAmount(amount);
        } else if (resolution == ClaimResolution.NONE) {
            String rejectNote = request.getNote() != null ? request.getNote().trim() : "";
            if (rejectNote.isBlank()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Reject reason is required so the buyer knows why");
            }
            claim.setStatus(ClaimStatus.REJECTED);
            claim.setResolution(ClaimResolution.NONE);
            claim.setResolvedAmount(BigDecimal.ZERO);
            claim.setResolutionNote(rejectNote);
        } else {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported resolution");
        }

        if (resolution != ClaimResolution.NONE) {
            claim.setResolutionNote(request.getNote() != null ? request.getNote().trim() : null);
        }
        claim.setResolvedBy(actorUserId);
        claim.setResolvedAt(Instant.now());
        claim.setUpdatedAt(Instant.now());
        orderClaimRepository.save(claim);

        try {
            if (claim.getStatus() == ClaimStatus.RESOLVED) {
                notificationClient.notifyClaimResolved(
                        order.getTownId(),
                        order.getId(),
                        order.getBuyerId(),
                        order.getBuyerPhoneSnapshot(),
                        order.getOrderNumber(),
                        claim.getResolvedAmount(),
                        item != null ? item.getItemNameSnapshot() : "your order");
            } else {
                notificationClient.notifyClaimRejected(
                        order.getTownId(),
                        order.getId(),
                        order.getBuyerId(),
                        order.getBuyerPhoneSnapshot(),
                        order.getOrderNumber(),
                        claim.getResolutionNote());
            }
        } catch (RuntimeException ex) {
            log.warn("Claim resolve notification failed for {}: {}", claimId, ex.toString());
        }

        return toResponse(claim, order, item);
    }

    public static boolean withinClaimWindow(Order order) {
        Instant deliveredAt = order.getDeliveredAt();
        if (deliveredAt == null) {
            return false;
        }
        return !Instant.now().isAfter(deliveredAt.plus(CLAIM_WINDOW));
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
            throw new BusinessException(ErrorCode.FORBIDDEN, "Claim town does not match hub scope");
        }
    }

    private OrderItem findItem(Order order, UUID itemId) {
        return order.getVendorSubOrders().stream()
                .flatMap(s -> s.getItems().stream())
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order item not found"));
    }

    private OrderItem findItemOrNull(Order order, UUID itemId) {
        if (itemId == null || order == null || order.getVendorSubOrders() == null) {
            return null;
        }
        return order.getVendorSubOrders().stream()
                .flatMap(s -> s.getItems().stream())
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElse(null);
    }

    /** Compact, parseable line for vendor payout UI. */
    private static String buildVendorChargebackReason(OrderClaim claim, String itemName, BigDecimal amount) {
        String type = claim.getClaimType() != null ? claim.getClaimType().name() : "CLAIM";
        String item = itemName != null && !itemName.isBlank() ? itemName.trim() : "item";
        String buyerNote = claim.getReason() != null ? claim.getReason().trim() : "";
        StringBuilder sb = new StringBuilder();
        sb.append("Claim chargeback (").append(type).append("): ").append(item);
        if (!buyerNote.isBlank()) {
            sb.append(" — buyer: ").append(buyerNote);
        }
        sb.append(" — credited ₹").append(amount.toPlainString());
        return sb.toString();
    }

    private ClaimResponse toResponse(OrderClaim claim, Order order, OrderItem item) {
        return ClaimResponse.builder()
                .claimId(claim.getId())
                .orderId(claim.getOrderId())
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderItemId(claim.getOrderItemId())
                .itemName(item != null ? item.getItemNameSnapshot() : null)
                .shopName(item != null ? item.getShopNameSnapshot() : null)
                .quantity(item != null ? item.getQuantity() : null)
                .unitCode(item != null ? item.getUnitCodeSnapshot() : null)
                .suggestedCreditAmount(item != null ? item.getLineTotal() : null)
                .buyerId(claim.getBuyerId())
                .townId(claim.getTownId())
                .claimType(claim.getClaimType())
                .status(claim.getStatus())
                .reason(claim.getReason())
                .resolution(claim.getResolution())
                .resolvedAmount(claim.getResolvedAmount())
                .resolutionNote(claim.getResolutionNote())
                .createdAt(claim.getCreatedAt())
                .resolvedAt(claim.getResolvedAt())
                .build();
    }
}

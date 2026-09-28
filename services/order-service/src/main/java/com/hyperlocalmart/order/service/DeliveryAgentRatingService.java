package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.client.TownClient;
import com.hyperlocalmart.order.dto.request.RateDeliveryAgentRequest;
import com.hyperlocalmart.order.dto.response.DeliveryAgentRatingAdminItem;
import com.hyperlocalmart.order.dto.response.DeliveryAgentRatingListResponse;
import com.hyperlocalmart.order.dto.response.DeliveryAgentRatingResponse;
import com.hyperlocalmart.order.dto.response.DeliveryAgentRatingView;
import com.hyperlocalmart.order.entity.DeliveryAgentRating;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.repository.DeliveryAgentRatingRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeliveryAgentRatingService {

    private final OrderRepository orderRepository;
    private final DeliveryAgentRatingRepository deliveryAgentRatingRepository;
    private final DeliveryClient deliveryClient;
    private final TownClient townClient;

    @Transactional
    public DeliveryAgentRatingResponse rate(UUID buyerId, UUID orderId, RateDeliveryAgentRequest request) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "You can rate the delivery agent only after delivery");
        }
        if (!ProductRatingService.withinRatingWindow(order)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Rating window has closed (30 days after delivery)");
        }

        DeliveryClient.OrderAssignment lastMile = lastMileAssignment(
                deliveryClient.getAssignmentsForOrder(order.getId()));
        if (lastMile == null || lastMile.agentId() == null) {
            throw new BusinessException(ErrorCode.CONFLICT, "No delivery agent is recorded for this order");
        }

        String comment = normalizeComment(request.getComment());
        DeliveryAgentRating rating = deliveryAgentRatingRepository.findByOrderId(order.getId())
                .orElseGet(() -> DeliveryAgentRating.builder()
                        .orderId(order.getId())
                        .buyerId(buyerId)
                        .townId(order.getTownId())
                        .build());
        rating.setAgentId(lastMile.agentId());
        rating.setAgentNameSnapshot(trimTo(lastMile.agentName(), 120));
        rating.setStars(request.getStars().shortValue());
        rating.setComment(comment);
        rating = deliveryAgentRatingRepository.save(rating);
        return toBuyerResponse(rating);
    }

    @Transactional(readOnly = true)
    public DeliveryAgentRatingView buyerView(Order order, List<DeliveryClient.OrderAssignment> assignments) {
        DeliveryAgentRating existing = deliveryAgentRatingRepository.findByOrderId(order.getId()).orElse(null);
        DeliveryClient.OrderAssignment lastMile = lastMileAssignment(assignments);
        boolean canRate = order.getStatus() == OrderStatus.DELIVERED
                && ProductRatingService.withinRatingWindow(order)
                && lastMile != null
                && lastMile.agentId() != null;
        if (existing == null && !canRate) {
            return null;
        }
        String agentName = existing != null && existing.getAgentNameSnapshot() != null
                ? existing.getAgentNameSnapshot()
                : lastMile == null ? null : lastMile.agentName();
        return DeliveryAgentRatingView.builder()
                .canRate(canRate)
                .agentName(blankToNull(agentName))
                .stars(existing == null ? null : (int) existing.getStars())
                .comment(existing == null ? null : existing.getComment())
                .build();
    }

    @Transactional(readOnly = true)
    public DeliveryAgentRatingListResponse listForAdmin(
            UUID actorUserId, List<String> roles, UUID agentId, int page, int size) {
        if (agentId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "agentId is required");
        }
        boolean superAdmin = roles != null && roles.contains("SUPER_ADMIN");
        boolean hubAdmin = roles != null && roles.contains("HUB_ADMIN");
        if (!superAdmin && !hubAdmin) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or super admin role required");
        }

        boolean visibleToHub = townClient.hubAdminCanSeeAgentRatings();
        UUID hubTownId = null;
        if (hubAdmin && !superAdmin) {
            if (!visibleToHub) {
                throw new BusinessException(
                        ErrorCode.FORBIDDEN, "Platform has hidden delivery ratings from hub admins");
            }
            hubTownId = deliveryClient.getHubAdminContext(actorUserId).townId();
        }

        PageRequest pageable = PageRequest.of(page, Math.min(Math.max(size, 1), 50));
        Page<DeliveryAgentRating> ratings = hubTownId == null
                ? deliveryAgentRatingRepository.findByAgentIdOrderByCreatedAtDesc(agentId, pageable)
                : deliveryAgentRatingRepository.findByAgentIdAndTownIdOrderByCreatedAtDesc(
                        agentId, hubTownId, pageable);

        List<UUID> orderIds = ratings.getContent().stream().map(DeliveryAgentRating::getOrderId).toList();
        Map<UUID, String> orderNumbers = orderIds.isEmpty()
                ? Map.of()
                : orderRepository.findAllById(orderIds).stream()
                        .collect(Collectors.toMap(Order::getId, Order::getOrderNumber, (a, b) -> a));

        Double avg = hubTownId == null
                ? deliveryAgentRatingRepository.averageStarsByAgentId(agentId)
                : deliveryAgentRatingRepository.averageStarsByAgentIdAndTownId(agentId, hubTownId);
        long count = hubTownId == null
                ? deliveryAgentRatingRepository.countByAgentId(agentId)
                : deliveryAgentRatingRepository.countByAgentIdAndTownId(agentId, hubTownId);

        return DeliveryAgentRatingListResponse.builder()
                .averageStars(avg == null ? 0 : Math.round(avg * 10.0) / 10.0)
                .ratingCount(count)
                .visibleToHub(visibleToHub)
                .items(ratings.getContent().stream()
                        .map(r -> DeliveryAgentRatingAdminItem.builder()
                                .ratingId(r.getId())
                                .orderId(r.getOrderId())
                                .orderNumber(orderNumbers.get(r.getOrderId()))
                                .agentId(r.getAgentId())
                                .agentName(r.getAgentNameSnapshot())
                                .townId(r.getTownId())
                                .stars(r.getStars())
                                .comment(r.getComment())
                                .createdAt(r.getCreatedAt())
                                .build())
                        .toList())
                .page(ratings.getNumber())
                .size(ratings.getSize())
                .totalElements(ratings.getTotalElements())
                .totalPages(ratings.getTotalPages())
                .build();
    }

    static DeliveryClient.OrderAssignment lastMileAssignment(List<DeliveryClient.OrderAssignment> assignments) {
        if (assignments == null || assignments.isEmpty()) {
            return null;
        }
        Comparator<DeliveryClient.OrderAssignment> byWhen = Comparator.comparing(
                DeliveryAgentRatingService::assignmentWhen, Comparator.nullsLast(Comparator.reverseOrder()));
        return assignments.stream()
                .filter(a -> a != null && a.agentId() != null && "LAST_MILE".equalsIgnoreCase(a.legType()))
                .sorted(byWhen)
                .findFirst()
                .orElse(null);
    }

    private static Instant assignmentWhen(DeliveryClient.OrderAssignment a) {
        if (a.completedAt() != null) return a.completedAt();
        if (a.startedAt() != null) return a.startedAt();
        return a.assignedAt();
    }

    private static DeliveryAgentRatingResponse toBuyerResponse(DeliveryAgentRating rating) {
        return DeliveryAgentRatingResponse.builder()
                .ratingId(rating.getId())
                .orderId(rating.getOrderId())
                .agentId(rating.getAgentId())
                .stars(rating.getStars())
                .comment(rating.getComment())
                .build();
    }

    private static String normalizeComment(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > 400 ? trimmed.substring(0, 400) : trimmed;
    }

    private static String trimTo(String raw, int max) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }

    private static String blankToNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return raw.trim();
    }
}

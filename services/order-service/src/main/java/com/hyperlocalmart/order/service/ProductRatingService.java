package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.CatalogClient;
import com.hyperlocalmart.order.dto.request.RateOrderItemRequest;
import com.hyperlocalmart.order.dto.response.ProductRatingResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.ProductRating;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.ProductRatingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductRatingService {

    /** Buyers may rate within 30 days of delivery. */
    public static final Duration RATING_WINDOW = Duration.ofDays(30);

    private final OrderRepository orderRepository;
    private final ProductRatingRepository productRatingRepository;
    private final CatalogClient catalogClient;

    @Transactional
    public ProductRatingResponse rateItem(UUID buyerId, UUID orderId, RateOrderItemRequest request) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));

        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "You can rate products only after delivery");
        }
        if (!withinRatingWindow(order)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Rating window has closed (30 days after delivery)");
        }

        OrderItem item = findItem(order, request.getOrderItemId());
        OrderItemStatus st = item.getStatus() == null ? OrderItemStatus.ACTIVE : item.getStatus();
        if (st == OrderItemStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cancelled items cannot be rated");
        }

        int stars = request.getStars();
        ProductRating existing = productRatingRepository.findByOrderItemId(item.getId()).orElse(null);
        if (existing != null) {
            throw new BusinessException(ErrorCode.CONFLICT, "You already rated this product");
        }

        ProductRating rating = ProductRating.builder()
                .orderId(order.getId())
                .orderItemId(item.getId())
                .buyerId(buyerId)
                .townId(order.getTownId())
                .listingId(item.getListingId())
                .masterItemId(item.getMasterItemId())
                .stars((short) stars)
                .build();
        rating = productRatingRepository.save(rating);

        try {
            catalogClient.applyListingRating(item.getListingId(), stars, null);
        } catch (RuntimeException ex) {
            log.warn("Could not sync listing rating for {}: {}", item.getListingId(), ex.getMessage());
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not save product rating. Try again.");
        }

        return ProductRatingResponse.builder()
                .ratingId(rating.getId())
                .orderId(rating.getOrderId())
                .orderItemId(rating.getOrderItemId())
                .listingId(rating.getListingId())
                .stars(rating.getStars())
                .build();
    }

    public static boolean withinRatingWindow(Order order) {
        if (order.getDeliveredAt() == null) {
            return false;
        }
        return Instant.now().isBefore(order.getDeliveredAt().plus(RATING_WINDOW));
    }

    private static OrderItem findItem(Order order, UUID orderItemId) {
        if (order.getVendorSubOrders() == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Order item not found");
        }
        return order.getVendorSubOrders().stream()
                .flatMap(s -> s.getItems().stream())
                .filter(i -> i.getId().equals(orderItemId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order item not found"));
    }
}

package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.ProductRating;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRatingRepository extends JpaRepository<ProductRating, UUID> {

    Optional<ProductRating> findByOrderItemId(UUID orderItemId);

    List<ProductRating> findByOrderId(UUID orderId);

    List<ProductRating> findByOrderItemIdIn(Collection<UUID> orderItemIds);
}

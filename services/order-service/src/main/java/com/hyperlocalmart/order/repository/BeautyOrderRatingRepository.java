package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.BeautyOrderRating;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BeautyOrderRatingRepository extends JpaRepository<BeautyOrderRating, UUID> {

    Optional<BeautyOrderRating> findByOrderId(UUID orderId);
}

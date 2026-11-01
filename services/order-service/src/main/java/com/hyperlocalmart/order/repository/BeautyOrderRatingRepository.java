package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.BeautyOrderRating;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BeautyOrderRatingRepository extends JpaRepository<BeautyOrderRating, UUID> {

    Optional<BeautyOrderRating> findByOrderId(UUID orderId);

    List<BeautyOrderRating> findByVendorIdOrderByCreatedAtDesc(UUID vendorId);

    List<BeautyOrderRating> findByVendorIdInAndCommentIsNotNullOrderByCreatedAtDesc(Collection<UUID> vendorIds);

    Page<BeautyOrderRating> findByVendorIdAndCommentIsNotNullOrderByCreatedAtDesc(UUID vendorId, Pageable pageable);

    long countByVendorIdAndCommentIsNotNull(UUID vendorId);

    @Query("SELECT r.stars, COUNT(r) FROM BeautyOrderRating r WHERE r.vendorId = :vendorId GROUP BY r.stars")
    List<Object[]> countByStarsForVendor(@Param("vendorId") UUID vendorId);
}

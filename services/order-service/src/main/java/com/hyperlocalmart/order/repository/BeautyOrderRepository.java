package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.beauty.BeautyOrderStatus;
import com.hyperlocalmart.order.entity.BeautyOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BeautyOrderRepository extends JpaRepository<BeautyOrder, UUID> {

    List<BeautyOrder> findByBuyerIdAndTownIdOrderByPlacedAtDesc(UUID buyerId, UUID townId);

    Optional<BeautyOrder> findByIdAndBuyerId(UUID id, UUID buyerId);

    List<BeautyOrder> findByVendorIdOrderByPlacedAtDesc(UUID vendorId);

    List<BeautyOrder> findByTownIdOrderByPlacedAtDesc(UUID townId);

    boolean existsByReferencePhotoMediaId(UUID referencePhotoMediaId);

    long countByVendorIdAndSlotStartAndStatusNot(UUID vendorId, Instant slotStart, BeautyOrderStatus status);

    List<BeautyOrder> findByVendorIdAndSlotStartGreaterThanEqualAndSlotStartLessThanAndStatusNotOrderBySlotStartAsc(
            UUID vendorId,
            Instant rangeStart,
            Instant rangeEnd,
            BeautyOrderStatus status);
}

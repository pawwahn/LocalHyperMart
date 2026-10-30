package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.beauty.BeautyOrderStatus;
import com.hyperlocalmart.order.entity.BeautyOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
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

    @Query("""
            select o from BeautyOrder o
            where o.vendorId = :vendorId
              and o.townId = :townId
              and o.status = com.hyperlocalmart.order.beauty.BeautyOrderStatus.COMPLETED
              and coalesce(o.completedAt, o.slotEnd, o.placedAt) >= :start
              and coalesce(o.completedAt, o.slotEnd, o.placedAt) < :end
            order by coalesce(o.completedAt, o.slotEnd, o.placedAt) asc
            """)
    List<BeautyOrder> findSettlementCandidates(
            @Param("vendorId") UUID vendorId,
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    List<BeautyOrder> findByVendorIdAndIdIn(UUID vendorId, Collection<UUID> ids);

    @Query("""
            select o.vendorId, o.townId, o.id
            from BeautyOrder o
            where o.status = com.hyperlocalmart.order.beauty.BeautyOrderStatus.COMPLETED
              and coalesce(o.completedAt, o.slotEnd, o.placedAt) >= :start
              and coalesce(o.completedAt, o.slotEnd, o.placedAt) < :end
            """)
    List<Object[]> findSettlementKeys(@Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            select distinct o.vendorId, o.townId
            from BeautyOrder o
            where o.status = com.hyperlocalmart.order.beauty.BeautyOrderStatus.COMPLETED
              and coalesce(o.completedAt, o.slotEnd, o.placedAt) >= :start
              and coalesce(o.completedAt, o.slotEnd, o.placedAt) < :end
            """)
    List<Object[]> findDeliveredVendorTowns(@Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            select o from BeautyOrder o
            where o.vendorId = :vendorId
              and o.status <> com.hyperlocalmart.order.beauty.BeautyOrderStatus.CANCELLED
              and o.status <> com.hyperlocalmart.order.beauty.BeautyOrderStatus.AWAITING_PAYMENT
              and coalesce(o.completedAt, o.slotEnd, o.placedAt) >= :start
              and coalesce(o.completedAt, o.slotEnd, o.placedAt) < :end
            order by coalesce(o.completedAt, o.slotEnd, o.placedAt) desc
            """)
    List<BeautyOrder> findSalesReportByVendorId(
            @Param("vendorId") UUID vendorId, @Param("start") Instant start, @Param("end") Instant end);
}

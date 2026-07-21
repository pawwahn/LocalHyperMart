package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.VendorListing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorListingRepository extends JpaRepository<VendorListing, UUID> {

    Page<VendorListing> findByVendorIdOrderByCreatedAtDesc(UUID vendorId, Pageable pageable);

    List<VendorListing> findByVendorIdOrderByCreatedAtDesc(UUID vendorId);

    Optional<VendorListing> findByIdAndVendorId(UUID id, UUID vendorId);

    boolean existsByVendorIdAndMasterItemId(UUID vendorId, UUID masterItemId);

    Optional<VendorListing> findByVendorIdAndMasterItemId(UUID vendorId, UUID masterItemId);

    @Query("""
            SELECT vl FROM VendorListing vl
            JOIN vl.masterItem mi
            WHERE vl.townId = :townId
              AND vl.active = true
              AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
            ORDER BY mi.name ASC
            """)
    Page<VendorListing> findActiveByTown(@Param("townId") UUID townId, Pageable pageable);

    @Query("""
            SELECT vl FROM VendorListing vl
            JOIN vl.masterItem mi
            WHERE vl.townId = :townId
              AND vl.active = true
              AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
              AND LOWER(mi.name) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY mi.name ASC
            """)
    Page<VendorListing> searchActiveByTown(@Param("townId") UUID townId, @Param("q") String q, Pageable pageable);

    @Query("""
            SELECT vl FROM VendorListing vl
            JOIN vl.masterItem mi
            WHERE (:townId IS NULL OR vl.townId = :townId)
              AND (:vendorId IS NULL OR vl.vendorId = :vendorId)
              AND (:active IS NULL OR vl.active = :active)
            ORDER BY mi.name ASC
            """)
    Page<VendorListing> findForAdmin(
            @Param("townId") UUID townId,
            @Param("vendorId") UUID vendorId,
            @Param("active") Boolean active,
            Pageable pageable);
}

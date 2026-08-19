package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.VendorListing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorListingRepository extends JpaRepository<VendorListing, UUID> {

    Page<VendorListing> findByVendorIdOrderByCreatedAtDesc(UUID vendorId, Pageable pageable);

    List<VendorListing> findByVendorIdOrderByCreatedAtDesc(UUID vendorId);

    Optional<VendorListing> findByIdAndVendorId(UUID id, UUID vendorId);

    boolean existsByVendorIdAndMasterItemId(UUID vendorId, UUID masterItemId);

    Optional<VendorListing> findByVendorIdAndMasterItemId(UUID vendorId, UUID masterItemId);

    long countByMasterItem_Id(UUID masterItemId);

    @Query(
            value = """
                    SELECT vl FROM VendorListing vl
                    JOIN FETCH vl.masterItem mi
                    JOIN FETCH mi.category cat
                    JOIN FETCH mi.unit u
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:categoryId IS NULL OR cat.id = :categoryId)
                    """,
            countQuery = """
                    SELECT count(vl) FROM VendorListing vl
                    JOIN vl.masterItem mi
                    JOIN mi.category cat
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:categoryId IS NULL OR cat.id = :categoryId)
                    """)
    Page<VendorListing> browseActive(
            @Param("townId") UUID townId,
            @Param("categoryId") UUID categoryId,
            Pageable pageable);

    @Query(
            value = """
                    SELECT vl FROM VendorListing vl
                    JOIN FETCH vl.masterItem mi
                    JOIN FETCH mi.category cat
                    JOIN FETCH mi.unit u
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:categoryId IS NULL OR cat.id = :categoryId)
                      AND LOWER(mi.name) LIKE LOWER(CONCAT('%', :q, '%'))
                    """,
            countQuery = """
                    SELECT count(vl) FROM VendorListing vl
                    JOIN vl.masterItem mi
                    JOIN mi.category cat
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:categoryId IS NULL OR cat.id = :categoryId)
                      AND LOWER(mi.name) LIKE LOWER(CONCAT('%', :q, '%'))
                    """)
    Page<VendorListing> searchActive(
            @Param("townId") UUID townId,
            @Param("categoryId") UUID categoryId,
            @Param("q") String q,
            Pageable pageable);

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

    @Query(
            value = """
                    SELECT vl FROM VendorListing vl
                    JOIN FETCH vl.masterItem mi
                    JOIN FETCH mi.category cat
                    JOIN FETCH mi.unit u
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:excluded IS NULL OR vl.id NOT IN :excluded)
                      AND (
                            (vl.discountPrice IS NOT NULL AND vl.discountPrice < vl.price)
                            OR (
                              vl.specialDiscountPrice IS NOT NULL
                              AND (vl.specialDiscountValidFrom IS NULL OR vl.specialDiscountValidFrom <= :now)
                              AND (vl.specialDiscountValidTo IS NULL OR vl.specialDiscountValidTo >= :now)
                            )
                          )
                    """,
            countQuery = """
                    SELECT count(vl) FROM VendorListing vl
                    JOIN vl.masterItem mi
                    JOIN mi.category cat
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:excluded IS NULL OR vl.id NOT IN :excluded)
                      AND (
                            (vl.discountPrice IS NOT NULL AND vl.discountPrice < vl.price)
                            OR (
                              vl.specialDiscountPrice IS NOT NULL
                              AND (vl.specialDiscountValidFrom IS NULL OR vl.specialDiscountValidFrom <= :now)
                              AND (vl.specialDiscountValidTo IS NULL OR vl.specialDiscountValidTo >= :now)
                            )
                          )
                    """)
    Page<VendorListing> findDiscountedActiveInTown(
            @Param("townId") UUID townId,
            @Param("excluded") Collection<UUID> excluded,
            @Param("now") Instant now,
            Pageable pageable);

    @Query(
            value = """
                    SELECT vl FROM VendorListing vl
                    JOIN FETCH vl.masterItem mi
                    JOIN FETCH mi.category cat
                    JOIN FETCH mi.unit u
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:excluded IS NULL OR vl.id NOT IN :excluded)
                    ORDER BY COALESCE(vl.priceUpdatedAt, vl.updatedAt) DESC
                    """,
            countQuery = """
                    SELECT count(vl) FROM VendorListing vl
                    JOIN vl.masterItem mi
                    JOIN mi.category cat
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:excluded IS NULL OR vl.id NOT IN :excluded)
                    """)
    Page<VendorListing> findRecentlyUpdatedActiveInTown(
            @Param("townId") UUID townId,
            @Param("excluded") Collection<UUID> excluded,
            Pageable pageable);

    @Query(
            value = """
                    SELECT vl FROM VendorListing vl
                    JOIN FETCH vl.masterItem mi
                    JOIN FETCH mi.category cat
                    JOIN FETCH mi.unit u
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:excluded IS NULL OR vl.id NOT IN :excluded)
                    ORDER BY vl.createdAt DESC
                    """,
            countQuery = """
                    SELECT count(vl) FROM VendorListing vl
                    JOIN vl.masterItem mi
                    JOIN mi.category cat
                    WHERE vl.townId = :townId
                      AND vl.active = true
                      AND mi.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                      AND (
                            (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.ACTIVE
                              AND NOT EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = false
                              )
                            )
                            OR (
                              cat.status = com.hyperlocalmart.catalog.entity.CatalogItemStatus.INACTIVE
                              AND EXISTS (
                                SELECT 1 FROM CategoryTownOverride o
                                WHERE o.categoryId = cat.id AND o.townId = :townId AND o.visible = true
                              )
                            )
                          )
                      AND (:excluded IS NULL OR vl.id NOT IN :excluded)
                    """)
    Page<VendorListing> findRecentlyAddedActiveInTown(
            @Param("townId") UUID townId,
            @Param("excluded") Collection<UUID> excluded,
            Pageable pageable);
}

package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.MasterItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface MasterItemRepository extends JpaRepository<MasterItem, UUID> {

    @Query("""
            SELECT m FROM MasterItem m
            WHERE m.status = :status
              AND (:#{#categoryId == null} = true OR m.category.id = :categoryId)
              AND (:#{#unitId == null} = true OR m.unit.id = :unitId)
              AND (:#{#q == null || #q.isBlank()} = true OR LOWER(m.name) LIKE LOWER(CONCAT('%', :q, '%')))
            """)
    Page<MasterItem> searchActive(
            @Param("status") CatalogItemStatus status,
            @Param("categoryId") UUID categoryId,
            @Param("unitId") UUID unitId,
            @Param("q") String q,
            Pageable pageable);

    Optional<MasterItem> findByIdAndStatus(UUID id, CatalogItemStatus status);

    long countByCategory_Id(UUID categoryId);
}

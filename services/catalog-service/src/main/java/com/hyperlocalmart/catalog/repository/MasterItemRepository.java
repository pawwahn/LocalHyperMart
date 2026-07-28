package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.MasterItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MasterItemRepository extends JpaRepository<MasterItem, UUID> {

    Page<MasterItem> findByStatusOrderByNameAsc(CatalogItemStatus status, Pageable pageable);

    Page<MasterItem> findByStatusAndCategoryIdOrderByNameAsc(
            CatalogItemStatus status, UUID categoryId, Pageable pageable);

    Page<MasterItem> findByStatusAndNameContainingIgnoreCaseOrderByNameAsc(
            CatalogItemStatus status, String name, Pageable pageable);

    Page<MasterItem> findByStatusAndCategoryIdAndNameContainingIgnoreCaseOrderByNameAsc(
            CatalogItemStatus status, UUID categoryId, String name, Pageable pageable);

    Optional<MasterItem> findByIdAndStatus(UUID id, CatalogItemStatus status);
}

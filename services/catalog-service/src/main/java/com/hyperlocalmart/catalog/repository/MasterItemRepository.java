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

    Optional<MasterItem> findByIdAndStatus(UUID id, CatalogItemStatus status);
}

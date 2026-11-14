package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.FoodMenuItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FoodMenuItemRepository extends JpaRepository<FoodMenuItem, UUID> {

    List<FoodMenuItem> findByCategoryIdOrderBySortOrderAscNameAsc(UUID categoryId);

    List<FoodMenuItem> findByVendorIdOrderBySortOrderAsc(UUID vendorId);

    Optional<FoodMenuItem> findByIdAndVendorId(UUID id, UUID vendorId);

    long countByVendorIdAndActiveTrue(UUID vendorId);
}
package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.FoodMenuCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FoodMenuCategoryRepository extends JpaRepository<FoodMenuCategory, UUID> {

    List<FoodMenuCategory> findByVendorIdOrderBySortOrderAscNameAsc(UUID vendorId);

    Optional<FoodMenuCategory> findByIdAndVendorId(UUID id, UUID vendorId);

    boolean existsByVendorIdAndNameIgnoreCase(UUID vendorId, String name);
}
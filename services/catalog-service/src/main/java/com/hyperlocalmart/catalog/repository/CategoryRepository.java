package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findByStatusOrderByNameAsc(CatalogItemStatus status);

    boolean existsByNameIgnoreCase(String name);
}

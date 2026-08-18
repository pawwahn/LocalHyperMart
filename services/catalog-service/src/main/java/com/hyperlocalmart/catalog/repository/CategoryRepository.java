package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findByStatusOrderByNameAsc(CatalogItemStatus status);

    List<Category> findAllByOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Category c SET c.status = :status, c.updatedBy = :updatedBy")
    int updateAllStatuses(@Param("status") CatalogItemStatus status, @Param("updatedBy") UUID updatedBy);
}

package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RecipeRepository extends JpaRepository<Recipe, UUID> {

    @Query("""
            SELECT r FROM Recipe r
            WHERE r.enabled = true
              AND (:q IS NULL OR LOWER(r.searchText) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(r.name) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY r.name ASC
            """)
    List<Recipe> searchEnabled(@Param("q") String q);

    Optional<Recipe> findByIdAndEnabledTrue(UUID id);

    @Query("""
            SELECT r FROM Recipe r
            WHERE (:q IS NULL OR :q = '' OR LOWER(r.name) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(r.searchText) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY r.name ASC
            """)
    org.springframework.data.domain.Page<Recipe> adminSearch(@Param("q") String q, org.springframework.data.domain.Pageable pageable);
}

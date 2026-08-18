package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.CategoryTownOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryTownOverrideRepository extends JpaRepository<CategoryTownOverride, CategoryTownOverride.Pk> {

    List<CategoryTownOverride> findByCategoryId(UUID categoryId);

    List<CategoryTownOverride> findByCategoryIdAndTownIdIn(UUID categoryId, Collection<UUID> townIds);

    List<CategoryTownOverride> findByTownId(UUID townId);

    Optional<CategoryTownOverride> findByCategoryIdAndTownId(UUID categoryId, UUID townId);

    void deleteByCategoryId(UUID categoryId);

    void deleteByCategoryIdAndTownIdIn(UUID categoryId, Collection<UUID> townIds);

    @Modifying
    @Query("DELETE FROM CategoryTownOverride")
    void deleteAllOverrides();

    interface CountRow {
        UUID getCategoryId();

        boolean getVisible();

        long getCnt();
    }

    @Query("""
            SELECT o.categoryId AS categoryId, o.visible AS visible, COUNT(o) AS cnt
            FROM CategoryTownOverride o
            GROUP BY o.categoryId, o.visible
            """)
    List<CountRow> countGroupedByCategoryAndVisible();
}

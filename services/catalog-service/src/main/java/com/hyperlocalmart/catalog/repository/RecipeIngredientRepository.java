package com.hyperlocalmart.catalog.repository;

import com.hyperlocalmart.catalog.entity.RecipeIngredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RecipeIngredientRepository extends JpaRepository<RecipeIngredient, UUID> {

    @Query("""
            SELECT ri FROM RecipeIngredient ri
            JOIN FETCH ri.masterItem mi
            JOIN FETCH mi.unit u
            WHERE ri.recipeId = :recipeId
            ORDER BY ri.sortOrder ASC, mi.name ASC
            """)
    List<RecipeIngredient> findByRecipeIdOrderBySortOrder(@Param("recipeId") UUID recipeId);

    long countByRecipeId(UUID recipeId);

    @Modifying
    @Query("DELETE FROM RecipeIngredient ri WHERE ri.recipeId = :recipeId")
    void deleteByRecipeId(@Param("recipeId") UUID recipeId);
}

package com.hyperlocalmart.catalog.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Entity
@Table(name = "recipe_ingredients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecipeIngredient {

    @Id
    @Column(nullable = false)
    private UUID id;

    @Column(name = "recipe_id", nullable = false)
    private UUID recipeId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "master_item_id", nullable = false)
    private MasterItem masterItem;

    @Column(name = "quantity_label", nullable = false, length = 80)
    @Builder.Default
    private String quantityLabel = "";

    @Column(name = "sort_order", nullable = false)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Builder.Default
    private int sortOrder = 0;
}

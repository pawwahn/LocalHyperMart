package com.hyperlocalmart.catalog.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "food_menu_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FoodMenuItem extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "category_id", nullable = false)
    private UUID categoryId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 500)
    private String description;

    /** Shown to buyer — mandatory (allergens, portion, prep). */
    @Column(name = "buyer_note", nullable = false, length = 500)
    private String buyerNote;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    /** true = veg, false = non-veg — mandatory choice when saving. */
    @Column(nullable = false)
    private boolean veg;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "master_item_id")
    private UUID masterItemId;

    @Column(name = "vendor_listing_id")
    private UUID vendorListingId;
}
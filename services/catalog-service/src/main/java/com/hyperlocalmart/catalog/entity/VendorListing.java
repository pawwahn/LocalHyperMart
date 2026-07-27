package com.hyperlocalmart.catalog.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vendor_listings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VendorListing extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "shop_id", nullable = false)
    private UUID shopId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "master_item_id", nullable = false)
    private MasterItem masterItem;

    @Column(name = "vendor_mrp", precision = 12, scale = 2)
    private BigDecimal vendorMrp;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "discount_price", precision = 12, scale = 2)
    private BigDecimal discountPrice;

    @Column(name = "special_discount_price", precision = 12, scale = 2)
    private BigDecimal specialDiscountPrice;

    @Column(name = "special_discount_valid_from")
    private Instant specialDiscountValidFrom;

    @Column(name = "special_discount_valid_to")
    private Instant specialDiscountValidTo;

    @Column(name = "vendor_note", length = 500)
    private String vendorNote;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "avg_rating", nullable = false, precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal avgRating = BigDecimal.ZERO;

    @Column(name = "rating_count", nullable = false)
    @Builder.Default
    private int ratingCount = 0;

    @Column(name = "price_updated_at")
    private Instant priceUpdatedAt;
}

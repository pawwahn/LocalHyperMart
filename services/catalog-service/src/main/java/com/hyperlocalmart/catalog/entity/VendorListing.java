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

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "discount_price", precision = 12, scale = 2)
    private BigDecimal discountPrice;

    @Column(name = "vendor_note", length = 500)
    private String vendorNote;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "price_updated_at")
    private Instant priceUpdatedAt;
}

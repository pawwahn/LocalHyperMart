package com.hyperlocalmart.vendor.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "food_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FoodProfile extends BaseAuditEntity {

    @Id
    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = false;

    @Column(length = 200)
    private String tagline;

    @Column(length = 300)
    private String cuisines;

    @Column(name = "pure_veg", nullable = false)
    @Builder.Default
    private boolean pureVeg = false;

    @Column(name = "opens_at_label", length = 40)
    private String opensAtLabel;

    @Column(name = "price_for_one", precision = 12, scale = 2)
    private BigDecimal priceForOne;

    @Column(name = "offer_label", length = 80)
    private String offerLabel;

    @Column(name = "rating_score", nullable = false, precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal ratingScore = BigDecimal.ZERO;

    @Column(name = "rating_count", nullable = false)
    @Builder.Default
    private int ratingCount = 0;

    @Column(name = "accepting_orders", nullable = false)
    @Builder.Default
    private boolean acceptingOrders = true;

    @Column(name = "hotel_photo_media_ids", nullable = false, length = 600)
    @Builder.Default
    private String hotelPhotoMediaIds = "[]";
}
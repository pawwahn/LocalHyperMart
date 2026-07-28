package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CatalogItemResponse {

    private UUID listingId;
    private UUID masterItemId;
    private String name;
    private String unit;
    private String shopName;
    private UUID vendorId;
    private BigDecimal mrp;
    private BigDecimal price;
    private BigDecimal discountPrice;
    private BigDecimal specialDiscountPrice;
    private BigDecimal effectivePrice;
    private boolean specialOfferActive;
    private String vendorNote;
    /** Primary image (sort order 0); kept for older clients. */
    private String imageUrl;
    /** Up to 3 master-item images, ordered by sort_order. */
    private List<String> imageUrls;
    private BigDecimal avgRating;
    private int ratingCount;
}

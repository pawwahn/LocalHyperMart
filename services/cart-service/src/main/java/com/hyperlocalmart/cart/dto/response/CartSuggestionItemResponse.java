package com.hyperlocalmart.cart.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CartSuggestionItemResponse {

    private UUID listingId;
    private UUID masterItemId;
    private UUID categoryId;
    private String category;
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
    private String imageUrl;
    private List<String> imageUrls;
    private BigDecimal avgRating;
    private int ratingCount;
}

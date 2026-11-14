package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class FoodMenuResponses {

    private FoodMenuResponses() {
    }

    @Data
    @Builder
    public static class FoodMenuItemPhotoVm {
        private UUID mediaId;
        private String url;
    }

    @Data
    @Builder
    public static class FoodMenuItemVm {
        private UUID id;
        private UUID categoryId;
        private String name;
        private String description;
        private String buyerNote;
        private BigDecimal price;
        private boolean veg;
        private boolean active;
        private int sortOrder;
        private UUID listingId;
        /** Up to 3 dish photos with stable media ids (for vendor edit form). */
        private List<FoodMenuItemPhotoVm> photos;
        /** Up to 3 dish photos (vendor listing images). */
        private List<String> imageUrls;
    }

    @Data
    @Builder
    public static class FoodMenuCategoryVm {
        private UUID id;
        private String name;
        private boolean active;
        private int sortOrder;
        private List<FoodMenuItemVm> items;
    }

    @Data
    @Builder
    public static class VendorFoodMenuResponse {
        private UUID vendorId;
        private List<FoodMenuCategoryVm> categories;
    }

    @Data
    @Builder
    public static class BuyerFoodMenuResponse {
        private UUID vendorId;
        private String shopName;
        private List<FoodMenuCategoryVm> categories;
    }
}
package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class FoodHotelCardResponse {

    private UUID vendorId;
    private String businessName;
    private String shopName;
    private String tagline;
    private String cuisines;
    private boolean pureVeg;
    private String opensAtLabel;
    private BigDecimal priceForOne;
    private String offerLabel;
    private BigDecimal ratingScore;
    private int ratingCount;
    private boolean acceptingOrders;

    @Builder.Default
    private List<HotelPhoto> hotelPhotos = new ArrayList<>();

    @Data
    @Builder
    public static class HotelPhoto {
        private UUID mediaId;
        private String url;
    }
}
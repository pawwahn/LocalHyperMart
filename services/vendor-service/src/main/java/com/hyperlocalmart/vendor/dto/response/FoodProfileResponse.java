package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class FoodProfileResponse {

    private UUID vendorId;
    private boolean enabled;
    private String tagline;
    private String cuisines;
    private boolean pureVeg;
    private String opensAtLabel;
    private BigDecimal priceForOne;
    private String offerLabel;
    private BigDecimal ratingScore;
    private int ratingCount;
    private boolean acceptingOrders;
    private List<FoodHotelCardResponse.HotelPhoto> hotelPhotos;
}
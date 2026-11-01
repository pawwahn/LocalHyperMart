package com.hyperlocalmart.order.dto.beauty;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class BeautyVendorReviewsSummary {

    private BigDecimal avgStars;
    private int totalRatings;
    private int reviewsWithComments;
    private int stars5;
    private int stars4;
    private int stars3;
    private int stars2;
    private int stars1;
}

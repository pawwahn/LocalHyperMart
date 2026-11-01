package com.hyperlocalmart.vendor.dto.request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ApplyBeautyRatingAggregateRequest {

    private BigDecimal ratingScore;
    private Integer ratingCount;
}

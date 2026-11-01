package com.hyperlocalmart.order.dto.beauty;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class BeautyCustomerReview {

    private int stars;
    private String comment;
    private Instant createdAt;
}

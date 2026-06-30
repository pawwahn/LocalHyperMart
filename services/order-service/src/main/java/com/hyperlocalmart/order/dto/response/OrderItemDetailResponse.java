package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class OrderItemDetailResponse {

    private String name;
    private String shopName;
    private int quantity;
    private BigDecimal lineTotal;
}

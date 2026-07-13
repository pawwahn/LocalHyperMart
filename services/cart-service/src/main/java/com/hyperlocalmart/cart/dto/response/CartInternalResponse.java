package com.hyperlocalmart.cart.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CartInternalResponse {

    private UUID cartId;
    private UUID userId;
    private UUID townId;
    private String status;
    private BigDecimal itemsSubtotal;
    private BigDecimal promoDiscount;
    private String promoCode;
    private BigDecimal payableSubtotal;
    private int itemCount;
    private boolean minOrderMet;
    private List<CartInternalItemResponse> items;
}

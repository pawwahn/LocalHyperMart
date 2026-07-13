package com.hyperlocalmart.cart.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CartResponse {

    private UUID cartId;
    private UUID townId;
    private BigDecimal itemsSubtotal;
    private BigDecimal promoDiscount;
    private String promoCode;
    private String promoDescription;
    private BigDecimal payableSubtotal;
    private int itemCount;
    private List<CartItemResponse> items;
    private BigDecimal minOrderValue;
    private boolean minOrderMet;
}

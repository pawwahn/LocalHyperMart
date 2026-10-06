package com.hyperlocalmart.cart.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class CartMembershipAddonResponse {

    private String slab;
    private String label;
    private int credits;
    private BigDecimal price;
}

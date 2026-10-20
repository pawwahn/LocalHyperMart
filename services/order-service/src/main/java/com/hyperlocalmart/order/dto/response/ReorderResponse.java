package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class ReorderResponse {

    private UUID cartId;
    private UUID townId;
    private BigDecimal itemsSubtotal;
    private int itemCount;
    private boolean minOrderMet;
    private boolean priceChanged;
    @Builder.Default
    private List<String> skippedItemNames = new ArrayList<>();
}

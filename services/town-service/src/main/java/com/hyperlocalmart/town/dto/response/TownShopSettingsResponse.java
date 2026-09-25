package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class TownShopSettingsResponse {

    @Builder.Default
    private String themeColor = "#0C831F";

    @Builder.Default
    private boolean bestDealsEnabled = true;

    @Builder.Default
    private List<Integer> dealPrices = new ArrayList<>(List.of(19, 29, 49, 99));

    @Builder.Default
    private BigDecimal platformFee = BigDecimal.ZERO;

    @Builder.Default
    private boolean codEnabled = true;

    @Builder.Default
    private boolean upiEnabled = true;

    @Builder.Default
    private BigDecimal codCharge = BigDecimal.ZERO;
}

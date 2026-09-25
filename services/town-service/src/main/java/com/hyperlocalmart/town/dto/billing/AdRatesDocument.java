package com.hyperlocalmart.town.dto.billing;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdRatesDocument {

    @JsonProperty("HOME_HERO")
    private AdSlotRateDto homeHero;

    @JsonProperty("HOME_MID_GRID")
    private AdSlotRateDto homeMidGrid;

    @JsonProperty("CART_UPSELL")
    private AdSlotRateDto cartUpsell;
}

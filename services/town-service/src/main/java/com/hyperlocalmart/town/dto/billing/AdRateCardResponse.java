package com.hyperlocalmart.town.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdRateCardResponse {

    private UUID id;
    private BigDecimal taxPercent;
    private String notes;
    private AdSlotRateDto homeHero;
    private AdSlotRateDto homeMidGrid;
    private AdSlotRateDto cartUpsell;
}

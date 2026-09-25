package com.hyperlocalmart.town.dto.billing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertAdRateCardRequest {

    @NotNull
    @DecimalMin("0")
    @DecimalMax("28")
    private BigDecimal taxPercent;

    @Size(max = 500)
    private String notes;

    @NotNull
    @Valid
    private AdSlotRateDto homeHero;

    @NotNull
    @Valid
    private AdSlotRateDto homeMidGrid;

    @NotNull
    @Valid
    private AdSlotRateDto cartUpsell;
}

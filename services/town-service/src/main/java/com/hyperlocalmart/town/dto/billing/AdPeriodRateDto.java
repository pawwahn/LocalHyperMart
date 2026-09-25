package com.hyperlocalmart.town.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdPeriodRateDto {

    private BigDecimal oneTown;
    private BigDecimal extraTown;
    private BigDecimal allTowns;
}

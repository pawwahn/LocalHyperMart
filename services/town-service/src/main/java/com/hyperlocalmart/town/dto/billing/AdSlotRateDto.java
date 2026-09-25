package com.hyperlocalmart.town.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdSlotRateDto {

    private AdPeriodRateDto day;
    private AdPeriodRateDto week;
    private AdPeriodRateDto month;
    private AdPeriodRateDto year;
}

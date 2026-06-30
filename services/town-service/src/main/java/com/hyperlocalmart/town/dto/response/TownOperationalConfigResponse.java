package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class TownOperationalConfigResponse {

    private BigDecimal minOrderValue;
}

package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class PickupManifestLineResponse {

    private String name;
    private int quantity;
    private String unitCode;
    private BigDecimal lineTotal;
}

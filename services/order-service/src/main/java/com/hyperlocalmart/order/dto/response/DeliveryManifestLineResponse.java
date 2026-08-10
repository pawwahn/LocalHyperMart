package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class DeliveryManifestLineResponse {

    private String shopName;
    private String name;
    private int quantity;
    private String unitCode;
    private BigDecimal lineTotal;
}

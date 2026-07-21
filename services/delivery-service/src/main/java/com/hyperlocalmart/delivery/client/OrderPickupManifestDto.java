package com.hyperlocalmart.delivery.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderPickupManifestDto {

    private UUID subOrderId;
    private String subOrderNumber;
    private String orderNumber;
    private UUID shopId;
    private String shopName;
    private BigDecimal subtotal;
    private int totalItemCount;
    private List<Line> items = new ArrayList<>();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Line {
        private String name;
        private int quantity;

        /** Prefer unitCode; accept unit from older payloads. */
        @JsonProperty("unitCode")
        private String unitCode;

        @JsonProperty("unit")
        private String unit;

        private BigDecimal lineTotal;

        public String resolvedUnitCode() {
            if (unitCode != null && !unitCode.isBlank()) {
                return unitCode.trim();
            }
            if (unit != null && !unit.isBlank()) {
                return unit.trim();
            }
            return null;
        }
    }
}

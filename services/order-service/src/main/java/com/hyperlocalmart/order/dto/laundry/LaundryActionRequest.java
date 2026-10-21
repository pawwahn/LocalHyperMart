package com.hyperlocalmart.order.dto.laundry;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class LaundryActionRequest {

    @Size(max = 40)
    private String action;

    @Size(max = 400)
    private String note;

    private Instant pickupSlotStart;

    private Instant pickupSlotEnd;

    private Instant estimatedReadyAt;

    private List<LinePatch> lines = new ArrayList<>();

    @Data
    public static class LinePatch {
        private UUID lineId;
        private Integer confirmedQuantity;
        private BigDecimal unitPrice;
        @Size(max = 200)
        private String conditionNote;
    }
}

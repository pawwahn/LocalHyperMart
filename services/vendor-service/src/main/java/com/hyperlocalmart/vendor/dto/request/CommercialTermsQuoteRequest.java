package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
public class CommercialTermsQuoteRequest {

    /** Fallback when orderLines is empty (legacy / simple quote). */
    @DecimalMin("0.0")
    private BigDecimal grossAmount;

    @Min(0)
    private Integer orderCount;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    /**
     * Preferred: each settled sub-order with placed time so fees use the terms
     * version that was active on that order date.
     */
    @Valid
    private List<OrderLine> orderLines;

    /** When true, marks monthly subscription as charged for the period month. */
    private boolean markSubscriptionCharged;

    @Data
    public static class OrderLine {
        @NotNull
        @DecimalMin("0.0")
        private BigDecimal amount;

        private Instant placedAt;

        private LocalDate orderDate;
    }
}

package com.hyperlocalmart.payment.dto.request;

import com.hyperlocalmart.payment.entity.SettlementPeriodType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class CreateSettlementRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID vendorId;

    private String vendorName;

    @NotNull
    private LocalDate periodStart;

    @NotNull
    private LocalDate periodEnd;

    private SettlementPeriodType periodType = SettlementPeriodType.CUSTOM;

    @NotEmpty
    private List<UUID> subOrderIds;

    /**
     * Ignored — payment-service always recalculates fees from Vendor Billing.
     * Kept for backward-compatible request bodies from older clients.
     */
    private BigDecimal commissionAmount = BigDecimal.ZERO;

    /** When true, settlement is created as PAID with payout details. */
    private boolean markPaid = true;

    private String payoutMethod;

    private String transactionReference;

    private String transactionNotes;

    private Instant paidAt;

    /**
     * Optional admin penalty / other charge deducted from this payout
     * (tracked as an OTHER_CHARGE line for the vendor).
     */
    @DecimalMin("0.0")
    private BigDecimal otherChargesAmount = BigDecimal.ZERO;

    @Size(max = 500)
    private String otherChargesReason;
}

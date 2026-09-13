package com.hyperlocalmart.payment.dto.request;

import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementPeriodType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class CreateDeliverySettlementRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private SettlementPayeeType payeeType;

    @NotNull
    private UUID payeeId;

    private String payeeName;

    @NotNull
    private LocalDate periodStart;

    @NotNull
    private LocalDate periodEnd;

    private SettlementPeriodType periodType = SettlementPeriodType.CUSTOM;

    /** PER_ORDER or FRANCHISE */
    @NotBlank
    private String kind;

    private List<UUID> orderIds = new ArrayList<>();

    private boolean markPaid = true;

    private String payoutMethod;

    private String transactionReference;

    private String transactionNotes;

    private Instant paidAt;
}

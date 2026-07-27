package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class CreateCodCloseDayRequest {

    @NotNull
    private UUID agentId;

    @NotNull
    private UUID hubId;

    @NotNull
    private UUID townId;

    @NotNull
    private BigDecimal receivedAmount;

    @NotEmpty
    private List<UUID> orderIds;

    private String notes;

    /** Required hub PIN — verified against delivery-service hub admin pin. */
    private String pin;

    /** Defaults to today IST when omitted. */
    private LocalDate closeDate;
}

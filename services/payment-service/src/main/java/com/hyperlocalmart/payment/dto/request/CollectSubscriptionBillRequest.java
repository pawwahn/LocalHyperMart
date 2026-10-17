package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.UUID;

@Data
public class CollectSubscriptionBillRequest {
    @NotNull
    private UUID townId;
    @NotNull
    private UUID vendorId;
    private String vendorName;
    /** yyyy-MM */
    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}")
    private String month;
    @NotBlank
    private String payoutMethod;
    @NotBlank
    private String transactionReference;
    private String transactionNotes;
}

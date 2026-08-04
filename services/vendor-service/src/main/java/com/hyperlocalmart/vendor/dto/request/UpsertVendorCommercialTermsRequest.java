package com.hyperlocalmart.vendor.dto.request;

import com.hyperlocalmart.vendor.entity.VendorFeeModel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class UpsertVendorCommercialTermsRequest {

    @NotNull
    private VendorFeeModel feeModel;

    @DecimalMin("0.0")
    private BigDecimal commissionPercent;

    @DecimalMin("0.0")
    private BigDecimal perOrderFlatAmount;

    @DecimalMin("0.0")
    private BigDecimal monthlySubscriptionAmount;

    @Min(1)
    @Max(28)
    private Integer subscriptionBillingDay;

    @Valid
    private List<CommissionSlabRequest> commissionSlabs;

    @Size(max = 2000)
    private String notes;

    private LocalDate effectiveFrom;

    @Data
    public static class CommissionSlabRequest {
        /** Upper bound of this slab (inclusive). Null = open-ended top slab. */
        @DecimalMin("0.0")
        private BigDecimal uptoAmount;

        @NotNull
        @DecimalMin("0.0")
        private BigDecimal percent;
    }
}

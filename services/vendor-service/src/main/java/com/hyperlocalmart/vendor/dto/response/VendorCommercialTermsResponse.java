package com.hyperlocalmart.vendor.dto.response;

import com.hyperlocalmart.vendor.entity.VendorFeeModel;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class VendorCommercialTermsResponse {
    private UUID id;
    private UUID vendorId;
    private VendorFeeModel feeModel;
    private BigDecimal commissionPercent;
    private BigDecimal perOrderFlatAmount;
    private BigDecimal monthlySubscriptionAmount;
    private Integer subscriptionBillingDay;
    private List<CommissionSlab> commissionSlabs;
    private String notes;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private boolean current;
    private String lastSubscriptionChargedYm;
    private Instant updatedAt;

    @Data
    @Builder
    public static class CommissionSlab {
        private BigDecimal uptoAmount;
        private BigDecimal percent;
    }
}

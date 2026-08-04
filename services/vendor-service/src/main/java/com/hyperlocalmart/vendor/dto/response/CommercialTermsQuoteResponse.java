package com.hyperlocalmart.vendor.dto.response;

import com.hyperlocalmart.vendor.entity.VendorFeeModel;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CommercialTermsQuoteResponse {
    private UUID vendorId;
    private VendorFeeModel feeModel;
    private BigDecimal grossAmount;
    private int orderCount;
    private BigDecimal commissionAmount;
    private BigDecimal subscriptionAmount;
    private BigDecimal totalFeeAmount;
    private BigDecimal suggestedNet;
    private boolean subscriptionIncluded;
    private String appliedSlabLabel;
    private List<String> breakdownLines;
}

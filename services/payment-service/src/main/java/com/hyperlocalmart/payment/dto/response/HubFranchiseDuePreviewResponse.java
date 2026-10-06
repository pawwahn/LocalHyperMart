package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class HubFranchiseDuePreviewResponse {

    private int billingYear;
    private int billingMonth;
    private String periodStart;
    private String periodEnd;
    private boolean enabled;
    private boolean alreadyCollected;
    private BigDecimal amount;
    private String label;
}

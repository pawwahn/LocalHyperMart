package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.UUID;

@Value
@Builder
public class HubPlatformPaymentPayableResponse {

    UUID hubId;
    UUID townId;

    BigDecimal codOwedToCompany;
    boolean codPayable;
    boolean codPendingVerification;

    boolean franchiseEnabled;
    BigDecimal franchiseAmount;
    String franchisePeriodStart;
    String franchisePeriodEnd;
    String franchiseLabel;
    boolean franchisePayable;
    boolean franchisePendingVerification;

    BigDecimal suggestedTotal;
    boolean hasPendingSubmission;
    String pendingStatusLabel;
}

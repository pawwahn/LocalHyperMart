package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class MembershipMeResponse {
    boolean active;
    int creditsRemaining;
    int usableCredits;
    Instant expiresAt;
    String lastSlab;
    String pendingCashPurchaseId;
    List<MembershipPurchaseResponse> recentPurchases;
}

package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class MembershipMemberRow {
    UUID buyerId;
    String phone;
    String lastSlab;
    int creditsRemaining;
    int usableCredits;
    Instant expiresAt;
    boolean active;
}

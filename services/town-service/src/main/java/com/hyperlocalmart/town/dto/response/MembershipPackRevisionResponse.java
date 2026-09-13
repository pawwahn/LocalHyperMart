package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class MembershipPackRevisionResponse {
    UUID id;
    int versionNo;
    boolean sellingEnabled;
    BigDecimal quarterlyPrice;
    int quarterlyCredits;
    BigDecimal halfYearPrice;
    int halfYearCredits;
    BigDecimal annualPrice;
    int annualCredits;
    String changeSummary;
    UUID changedBy;
    Instant createdAt;
}

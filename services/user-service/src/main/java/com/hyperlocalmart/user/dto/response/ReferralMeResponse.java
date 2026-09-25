package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class ReferralMeResponse {
    boolean programEnabled;
    String code;
    String shareLink;
    String shareMessage;
    BigDecimal referrerRewardAmount;
    BigDecimal refereeRewardAmount;
    boolean hasAppliedCode;
    String appliedCode;
}

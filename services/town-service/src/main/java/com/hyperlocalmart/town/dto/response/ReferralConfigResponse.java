package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class ReferralConfigResponse {
    boolean enabled;
    BigDecimal referrerRewardAmount;
    BigDecimal refereeRewardAmount;
    String shareBaseUrl;
    String shareMessageTemplate;
}

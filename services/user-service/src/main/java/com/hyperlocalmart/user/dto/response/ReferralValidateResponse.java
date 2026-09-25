package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ReferralValidateResponse {
    boolean valid;
    boolean programEnabled;
}

package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class VerifyHubPinResponse {

    boolean valid;
}

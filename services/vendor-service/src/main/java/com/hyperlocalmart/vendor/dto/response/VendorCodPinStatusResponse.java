package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class VendorCodPinStatusResponse {
    boolean configured;
    boolean defaultPinActive;
}

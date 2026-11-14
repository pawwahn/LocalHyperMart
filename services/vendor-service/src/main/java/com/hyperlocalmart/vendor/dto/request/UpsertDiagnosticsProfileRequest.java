package com.hyperlocalmart.vendor.dto.request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertDiagnosticsProfileRequest {

    private Boolean enabled;
    private Boolean bookable;
    private BigDecimal homeCollectionFee;
}

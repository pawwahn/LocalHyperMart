package com.hyperlocalmart.town.dto.request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PatchTownFeatureFlagsRequest {

    private Boolean laundryEnabled;

    private Boolean beautyEnabled;

    private Boolean diagnosticsEnabled;

    private Boolean foodDeliveryEnabled;

    /** Grocery catalog and cart in this town (default on for existing towns). */
    private Boolean groceryEnabled;

    private BigDecimal diagnosticsPlatformFeeFlat;

    private Boolean diagnosticsCodEnabled;

    private BigDecimal diagnosticsCodSurchargeAmount;
}

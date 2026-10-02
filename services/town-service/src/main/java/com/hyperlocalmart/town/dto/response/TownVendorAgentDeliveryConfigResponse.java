package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class TownVendorAgentDeliveryConfigResponse {
    boolean enabled;
    /** Payout to vendor's delivery agent (x). */
    BigDecimal vendorAgentPayoutAmount;
    /** Payout to town hub for vendor-agent orders (y). */
    BigDecimal hubPayoutAmount;
}

package com.hyperlocalmart.common.tax;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

/**
 * GST split for one order/cart line (intra-state: CGST + SGST). Amounts are informational when
 * {@code priceIncludesTax} is true — they are already included in the line total, not added again.
 */
@Value
@Builder
public class GstLineTaxBreakdown {

    String hsnCode;
    BigDecimal gstPercent;
    BigDecimal cessPercent;
    boolean priceIncludesTax;
    String countryOfOrigin;

    BigDecimal taxableValue;
    BigDecimal cgstAmount;
    BigDecimal sgstAmount;
    BigDecimal igstAmount;
    BigDecimal cessAmount;
    BigDecimal totalTaxAmount;
}

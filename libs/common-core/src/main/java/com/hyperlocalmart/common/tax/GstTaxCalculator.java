package com.hyperlocalmart.common.tax;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;

/**
 * Indian GST helpers for retail lines (HSN + slab). Assumes intra-state supply (CGST/SGST split).
 */
public final class GstTaxCalculator {

    public static final Set<BigDecimal> ALLOWED_GST_SLABS = Set.of(
            bd("0"),
            bd("0.25"),
            bd("3"),
            bd("5"),
            bd("12"),
            bd("18"),
            bd("28"));

    private GstTaxCalculator() {
    }

    public static boolean isAllowedGstSlab(BigDecimal gstPercent) {
        if (gstPercent == null) {
            return false;
        }
        return ALLOWED_GST_SLABS.stream().anyMatch(s -> s.compareTo(gstPercent) == 0);
    }

    public static boolean isValidHsn(String hsn) {
        if (hsn == null) {
            return false;
        }
        String trimmed = hsn.trim();
        return trimmed.matches("^[0-9]{4,8}$");
    }

    /**
     * @param lineTotal line amount paid by buyer (inclusive or exclusive per flag)
     */
    public static GstLineTaxBreakdown computeLineTax(
            String hsnCode,
            BigDecimal gstPercent,
            BigDecimal cessPercent,
            boolean priceIncludesTax,
            String countryOfOrigin,
            BigDecimal lineTotal) {
        BigDecimal gst = nz(gstPercent);
        BigDecimal cess = nz(cessPercent);
        BigDecimal total = money(lineTotal);
        BigDecimal combinedRate = gst.add(cess);

        BigDecimal taxable;
        BigDecimal gstComponent;
        BigDecimal cessComponent;

        if (priceIncludesTax) {
            if (combinedRate.compareTo(BigDecimal.ZERO) <= 0) {
                taxable = total;
                gstComponent = BigDecimal.ZERO;
                cessComponent = BigDecimal.ZERO;
            } else {
                BigDecimal divisor = BigDecimal.ONE.add(combinedRate.divide(bd("100"), 8, RoundingMode.HALF_UP));
                taxable = money(total.divide(divisor, 8, RoundingMode.HALF_UP));
                gstComponent = money(taxable.multiply(gst).divide(bd("100"), 8, RoundingMode.HALF_UP));
                cessComponent = money(taxable.multiply(cess).divide(bd("100"), 8, RoundingMode.HALF_UP));
            }
        } else {
            taxable = total;
            gstComponent = money(taxable.multiply(gst).divide(bd("100"), 8, RoundingMode.HALF_UP));
            cessComponent = money(taxable.multiply(cess).divide(bd("100"), 8, RoundingMode.HALF_UP));
        }

        BigDecimal half = money(gstComponent.divide(bd("2"), 8, RoundingMode.HALF_UP));
        BigDecimal totalTax = money(gstComponent.add(cessComponent));

        return GstLineTaxBreakdown.builder()
                .hsnCode(hsnCode == null ? null : hsnCode.trim())
                .gstPercent(gst)
                .cessPercent(cess)
                .priceIncludesTax(priceIncludesTax)
                .countryOfOrigin(countryOfOrigin)
                .taxableValue(taxable)
                .cgstAmount(half)
                .sgstAmount(money(gstComponent.subtract(half)))
                .igstAmount(BigDecimal.ZERO)
                .cessAmount(cessComponent)
                .totalTaxAmount(totalTax)
                .build();
    }

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }
}

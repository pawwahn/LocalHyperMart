package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.entity.MasterItem;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.common.tax.GstTaxCalculator;

import java.math.BigDecimal;
import java.util.Locale;

public final class ProductTaxCompliance {

    private ProductTaxCompliance() {
    }

    public static void validateForSale(MasterItem item) {
        if (item == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Product tax details missing");
        }
        if (!GstTaxCalculator.isValidHsn(item.getHsnCode())) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "Product “" + item.getName() + "” needs a valid HSN code (4–8 digits) before it can be sold");
        }
        if (!GstTaxCalculator.isAllowedGstSlab(item.getGstPercent())) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "Product “" + item.getName() + "” needs a valid GST slab (0, 0.25, 3, 5, 12, 18, or 28%)");
        }
        BigDecimal cess = item.getCessPercent() == null ? BigDecimal.ZERO : item.getCessPercent();
        if (cess.compareTo(BigDecimal.ZERO) < 0 || cess.compareTo(new BigDecimal("100")) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "CESS must be between 0 and 100%");
        }
    }

    public static void applyTaxFields(
            MasterItem item,
            String hsnCode,
            BigDecimal gstPercent,
            BigDecimal cessPercent,
            Boolean priceIncludesTax,
            String countryOfOrigin) {
        String hsn = hsnCode == null ? null : hsnCode.trim();
        if (!GstTaxCalculator.isValidHsn(hsn)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "HSN code must be 4–8 digits");
        }
        BigDecimal gst = gstPercent == null ? null : gstPercent;
        if (!GstTaxCalculator.isAllowedGstSlab(gst)) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "GST must be one of: 0, 0.25, 3, 5, 12, 18, 28%");
        }
        BigDecimal cess = cessPercent == null ? BigDecimal.ZERO : cessPercent;
        if (cess.compareTo(BigDecimal.ZERO) < 0 || cess.compareTo(new BigDecimal("100")) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "CESS must be between 0 and 100%");
        }
        String origin = countryOfOrigin == null || countryOfOrigin.isBlank()
                ? "IN"
                : countryOfOrigin.trim().toUpperCase(Locale.ROOT);
        if (origin.length() != 2) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Country of origin must be a 2-letter ISO code");
        }
        item.setHsnCode(hsn);
        item.setGstPercent(gst);
        item.setCessPercent(cess);
        item.setPriceIncludesTax(priceIncludesTax == null || priceIncludesTax);
        item.setCountryOfOrigin(origin);
    }
}

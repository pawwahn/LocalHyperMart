package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

import java.math.BigDecimal;
import java.time.Instant;

public final class ListingPricing {

    private ListingPricing() {
    }

    public static BigDecimal resolveMrp(VendorListing listing) {
        if (listing.getVendorMrp() != null) {
            return listing.getVendorMrp();
        }
        if (listing.getMasterItem().getMrp() != null) {
            return listing.getMasterItem().getMrp();
        }
        return listing.getPrice();
    }

    public static BigDecimal resolveEffectivePrice(VendorListing listing) {
        return resolveEffectivePrice(
                listing.getPrice(),
                listing.getDiscountPrice(),
                listing.getSpecialDiscountPrice(),
                listing.getSpecialDiscountValidFrom(),
                listing.getSpecialDiscountValidTo(),
                Instant.now());
    }

    public static BigDecimal resolveEffectivePrice(
            BigDecimal price,
            BigDecimal discountPrice,
            BigDecimal specialDiscountPrice,
            Instant specialValidFrom,
            Instant specialValidTo,
            Instant now) {
        if (isSpecialDiscountActive(specialDiscountPrice, specialValidFrom, specialValidTo, now)) {
            return specialDiscountPrice;
        }
        if (discountPrice != null) {
            return discountPrice;
        }
        return price;
    }

    public static boolean isSpecialDiscountActive(
            BigDecimal specialDiscountPrice,
            Instant specialValidFrom,
            Instant specialValidTo,
            Instant now) {
        if (specialDiscountPrice == null) {
            return false;
        }
        if (specialValidFrom == null && specialValidTo == null) {
            return true;
        }
        if (specialValidFrom != null && now.isBefore(specialValidFrom)) {
            return false;
        }
        if (specialValidTo != null && now.isAfter(specialValidTo)) {
            return false;
        }
        return true;
    }

    public static void validatePricing(
            BigDecimal price,
            BigDecimal vendorMrp,
            BigDecimal discountPrice,
            BigDecimal specialDiscountPrice,
            Instant specialValidFrom,
            Instant specialValidTo) {
        if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Price must be greater than zero");
        }
        if (vendorMrp != null && vendorMrp.compareTo(price) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "MRP cannot be less than regular price");
        }
        if (discountPrice != null) {
            if (discountPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Discount price must be greater than zero");
            }
            if (discountPrice.compareTo(price) > 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Discount price cannot exceed regular price");
            }
        }
        if (specialDiscountPrice != null) {
            if (specialDiscountPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Special discount price must be greater than zero");
            }
            if (specialDiscountPrice.compareTo(price) > 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Special discount price cannot exceed regular price");
            }
            if (discountPrice != null && specialDiscountPrice.compareTo(discountPrice) > 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Special discount price cannot exceed discount price");
            }
            if (vendorMrp != null && specialDiscountPrice.compareTo(vendorMrp) > 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Special discount price cannot exceed MRP");
            }
            if (specialValidFrom != null && specialValidTo != null && specialValidFrom.isAfter(specialValidTo)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Special discount start must be before end");
            }
        }
    }
}

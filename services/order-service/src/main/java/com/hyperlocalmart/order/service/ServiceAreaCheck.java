package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

import java.util.List;

/** Checkout rule: when a town lists pincodes, the delivery address must use one of them. */
public final class ServiceAreaCheck {

    private ServiceAreaCheck() {
    }

    public static void requireServed(String townName, List<String> servedPincodes, String addressPincode) {
        if (servedPincodes == null || servedPincodes.isEmpty()) {
            return;
        }
        String pin = addressPincode == null ? "" : addressPincode.trim();
        boolean served = !pin.isEmpty() && servedPincodes.stream()
                .anyMatch(candidate -> candidate != null && candidate.trim().equals(pin));
        if (served) {
            return;
        }
        String name = townName == null || townName.isBlank() ? "This town" : townName.trim();
        if (pin.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    name + " delivers only to its listed pincodes. Add the pincode on the address.");
        }
        throw new BusinessException(
                ErrorCode.VALIDATION_ERROR,
                name + " does not deliver to " + pin + ".");
    }
}

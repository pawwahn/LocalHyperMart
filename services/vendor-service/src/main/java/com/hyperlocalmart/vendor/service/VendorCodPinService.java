package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.client.UserClient;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorCodPinService {

    private static final String PILOT_DEFAULT_PIN = "1234";
    private static final String PIN_PATTERN = "^\\d{4,6}$";

    private final VendorRepository vendorRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserClient userClient;

    @Transactional(readOnly = true)
    public boolean pinConfigured(UUID userId) {
        Vendor vendor = resolveVendor(userId);
        return isConfigured(vendor.getCodPinHash());
    }

    @Transactional
    public void setPin(UUID userId, String newPin, String otp) {
        validatePinFormat(newPin);
        userClient.consumeCodPinOtp(userId, otp);
        Vendor vendor = resolveVendor(userId);
        vendor.setCodPinHash(passwordEncoder.encode(newPin));
        vendor.setUpdatedBy(userId);
        vendorRepository.save(vendor);
    }

    @Transactional(readOnly = true)
    public void verifyPin(UUID vendorId, String pin) {
        if (pin == null || pin.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Shop COD PIN is required");
        }
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        String hash = vendor.getCodPinHash();
        if (!isConfigured(hash)) {
            if (!PILOT_DEFAULT_PIN.equals(pin)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Invalid shop COD PIN");
            }
            return;
        }
        if (!passwordEncoder.matches(pin, hash)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Invalid shop COD PIN");
        }
    }

    private Vendor resolveVendor(UUID userId) {
        return vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
    }

    private static boolean isConfigured(String pinHash) {
        return pinHash != null && !pinHash.isBlank();
    }

    private static void validatePinFormat(String pin) {
        if (pin == null || !pin.matches(PIN_PATTERN)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "PIN must be 4–6 digits");
        }
    }
}

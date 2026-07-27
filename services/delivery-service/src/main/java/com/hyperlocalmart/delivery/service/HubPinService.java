package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.entity.HubAdmin;
import com.hyperlocalmart.delivery.repository.HubAdminRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HubPinService {

    private static final String HUB_ADMIN_ACTIVE = "ACTIVE";
    private static final String PILOT_DEFAULT_PIN = "1234";
    private static final String PIN_PATTERN = "^\\d{4,6}$";

    private final HubAdminRepository hubAdminRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public boolean pinConfigured(UUID userId) {
        HubAdmin hubAdmin = resolveActiveHubAdmin(userId);
        return isConfigured(hubAdmin.getPinHash());
    }

    @Transactional
    public void setPin(UUID userId, String newPin) {
        validatePinFormat(newPin);
        HubAdmin hubAdmin = resolveActiveHubAdmin(userId);
        hubAdmin.setPinHash(passwordEncoder.encode(newPin));
        hubAdmin.setUpdatedBy(userId);
        hubAdminRepository.save(hubAdmin);
    }

    @Transactional(readOnly = true)
    public void verifyPin(UUID userId, String pin) {
        if (pin == null || pin.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "pin is required");
        }
        HubAdmin hubAdmin = resolveActiveHubAdmin(userId);
        String hash = hubAdmin.getPinHash();
        if (!isConfigured(hash)) {
            if (!PILOT_DEFAULT_PIN.equals(pin)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Invalid hub PIN");
            }
            return;
        }
        if (!passwordEncoder.matches(pin, hash)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Invalid hub PIN");
        }
    }

    private HubAdmin resolveActiveHubAdmin(UUID userId) {
        return hubAdminRepository.findByUserIdAndStatus(userId, HUB_ADMIN_ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub admin not found"));
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

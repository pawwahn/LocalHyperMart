package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.request.RegisterDeviceRequest;
import com.hyperlocalmart.user.dto.response.DeviceRegistrationResponse;
import com.hyperlocalmart.user.dto.response.DeviceTokenInternalResponse;
import com.hyperlocalmart.user.entity.DeviceToken;
import com.hyperlocalmart.user.repository.DeviceTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeviceTokenService {

    private final DeviceTokenRepository deviceTokenRepository;

    @Transactional
    public DeviceRegistrationResponse register(UUID userId, RegisterDeviceRequest request) {
        String token = normalizeToken(request.getFcmToken());
        String platform = request.getPlatform().trim().toUpperCase();
        String appType = request.getAppType().trim().toUpperCase();
        Instant now = Instant.now();

        DeviceToken row = deviceTokenRepository.findByFcmToken(token).orElse(null);
        if (row == null) {
            row = DeviceToken.builder()
                    .userId(userId)
                    .platform(platform)
                    .fcmToken(token)
                    .appType(appType)
                    .lastUsedAt(now)
                    .build();
        } else {
            row.setUserId(userId);
            row.setPlatform(platform);
            row.setAppType(appType);
            row.setLastUsedAt(now);
        }
        DeviceToken saved = deviceTokenRepository.save(row);
        return DeviceRegistrationResponse.builder()
                .deviceId(saved.getId())
                .appType(saved.getAppType())
                .platform(saved.getPlatform())
                .build();
    }

    @Transactional(readOnly = true)
    public List<DeviceTokenInternalResponse> listForUser(UUID userId, String appType) {
        String normalizedApp = appType == null || appType.isBlank()
                ? null
                : appType.trim().toUpperCase();
        if (normalizedApp == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "appType is required");
        }
        return deviceTokenRepository.findByUserIdAndAppTypeOrderByLastUsedAtDesc(userId, normalizedApp)
                .stream()
                .map(row -> DeviceTokenInternalResponse.builder()
                        .fcmToken(row.getFcmToken())
                        .platform(row.getPlatform())
                        .appType(row.getAppType())
                        .build())
                .toList();
    }

    @Transactional
    public void deleteAllForUser(UUID userId) {
        deviceTokenRepository.deleteByUserId(userId);
    }

    @Transactional
    public void deleteByFcmToken(String fcmToken) {
        deviceTokenRepository.deleteByFcmToken(normalizeToken(fcmToken));
    }

    private static String normalizeToken(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "fcmToken is required");
        }
        return raw.trim();
    }
}

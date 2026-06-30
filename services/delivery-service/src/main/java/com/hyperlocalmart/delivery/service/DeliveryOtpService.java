package com.hyperlocalmart.delivery.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.entity.DeliveryOtp;
import com.hyperlocalmart.delivery.repository.DeliveryOtpRepository;
import com.hyperlocalmart.delivery.util.HashUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeliveryOtpService {

    private static final int OTP_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final int OTP_VALID_HOURS = 24;

    private final DeliveryOtpRepository deliveryOtpRepository;

    @Transactional
    public String issueOtp(UUID orderId) {
        String otp = HashUtils.randomNumericOtp(OTP_LENGTH);
        DeliveryOtp record = DeliveryOtp.builder()
                .orderId(orderId)
                .otpHash(HashUtils.sha256(otp))
                .expiresAt(Instant.now().plus(OTP_VALID_HOURS, ChronoUnit.HOURS))
                .build();
        deliveryOtpRepository.save(record);
        return otp;
    }

    @Transactional
    public void verifyOtp(UUID orderId, String otp) {
        DeliveryOtp record = deliveryOtpRepository.findFirstByOrderIdAndVerifiedAtIsNullOrderByCreatedAtDesc(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Delivery OTP not found"));

        if (record.getVerifiedAt() != null) {
            throw new BusinessException(ErrorCode.CONFLICT, "OTP already used");
        }
        if (record.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "OTP expired");
        }
        if (record.getAttempts() >= MAX_ATTEMPTS) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "OTP verification locked");
        }

        if (!HashUtils.sha256(otp).equals(record.getOtpHash())) {
            record.setAttempts(record.getAttempts() + 1);
            deliveryOtpRepository.save(record);
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid OTP");
        }

        record.setVerifiedAt(Instant.now());
        deliveryOtpRepository.save(record);
    }

    @Transactional
    public String overrideOtp(UUID orderId, UUID hubAdminUserId, String reason) {
        deliveryOtpRepository.findFirstByOrderIdAndVerifiedAtIsNullOrderByCreatedAtDesc(orderId)
                .ifPresent(existing -> {
                    existing.setVerifiedAt(Instant.now());
                    existing.setOverriddenBy(hubAdminUserId);
                    existing.setOverrideReason(reason);
                    deliveryOtpRepository.save(existing);
                });
        return issueOtp(orderId);
    }
}

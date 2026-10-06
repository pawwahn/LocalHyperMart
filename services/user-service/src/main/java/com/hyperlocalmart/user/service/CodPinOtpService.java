package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.config.OtpProperties;
import com.hyperlocalmart.user.entity.CodPinResetOtp;
import com.hyperlocalmart.user.entity.User;
import com.hyperlocalmart.user.repository.CodPinResetOtpRepository;
import com.hyperlocalmart.user.repository.UserRepository;
import com.hyperlocalmart.user.security.HashUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CodPinOtpService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final CodPinResetOtpRepository codPinResetOtpRepository;
    private final OtpProperties otpProperties;

    @Transactional
    public void requestOtp(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));

        Instant oneHourAgo = Instant.now().minus(1, ChronoUnit.HOURS);
        long recent = codPinResetOtpRepository.countByUserIdSince(userId, oneHourAgo);
        if (recent >= otpProperties.getMaxRequestsPerHour()) {
            throw new BusinessException(ErrorCode.RATE_LIMITED, "Too many OTP requests. Try again later.");
        }

        String otp = resolveOtpCode();
        CodPinResetOtp entity = CodPinResetOtp.builder()
                .userId(userId)
                .otpHash(HashUtils.sha256(otp))
                .expiresAt(Instant.now().plus(otpProperties.getExpirationMinutes(), ChronoUnit.MINUTES))
                .build();
        codPinResetOtpRepository.save(entity);
        log.info("COD PIN reset OTP for user {} phone {}: {} (dev log — use SMS in production)",
                userId, user.getPhone(), otp);
    }

    @Transactional
    public void consumeOtp(UUID userId, String otp) {
        if (otp == null || otp.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "OTP is required");
        }
        CodPinResetOtp record = codPinResetOtpRepository.findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid or expired OTP"));

        if (matchesFixedDevOtp(otp)) {
            markUsed(record);
            return;
        }

        if (!record.isUsable()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid or expired OTP");
        }
        if (record.getAttempts() >= otpProperties.getMaxVerifyAttempts()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "OTP verification locked");
        }

        if (!HashUtils.sha256(otp.trim()).equals(record.getOtpHash())) {
            record.setAttempts(record.getAttempts() + 1);
            codPinResetOtpRepository.save(record);
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid OTP");
        }
        markUsed(record);
    }

    private void markUsed(CodPinResetOtp record) {
        record.setUsedAt(Instant.now());
        codPinResetOtpRepository.save(record);
    }

    private String resolveOtpCode() {
        String fixed = otpProperties.getFixedCode();
        if (StringUtils.hasText(fixed)) {
            return fixed.trim();
        }
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    private boolean matchesFixedDevOtp(String otp) {
        String fixed = otpProperties.getFixedCode();
        return StringUtils.hasText(fixed) && fixed.trim().equals(otp.trim());
    }
}

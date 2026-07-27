package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.config.InviteProperties;
import com.hyperlocalmart.user.config.LoginProperties;
import com.hyperlocalmart.user.config.OtpProperties;
import com.hyperlocalmart.user.dto.request.*;
import com.hyperlocalmart.user.dto.response.AuthResponse;
import com.hyperlocalmart.user.dto.response.RegisterResponse;
import com.hyperlocalmart.user.entity.*;
import com.hyperlocalmart.user.repository.PasswordResetOtpRepository;
import com.hyperlocalmart.user.repository.RefreshTokenRepository;
import com.hyperlocalmart.user.repository.RoleRepository;
import com.hyperlocalmart.user.repository.UserRepository;
import com.hyperlocalmart.user.security.HashUtils;
import com.hyperlocalmart.user.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetOtpRepository passwordResetOtpRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginProperties loginProperties;
    private final OtpProperties otpProperties;
    private final InviteProperties inviteProperties;

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (inviteProperties.isRequireTerms() && !Boolean.TRUE.equals(request.getAcceptedTerms())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Accept Terms to register");
        }
        if (!inviteProperties.isPhoneAllowed(request.getPhone())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Invite-only soft launch. This number is not on the invite list.");
        }
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Phone number already registered");
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()
                && userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Email already registered");
        }

        Role buyerRole = roleRepository.findByName(RoleName.BUYER)
                .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "BUYER role not configured"));

        User user = User.builder()
                .phone(request.getPhone())
                .email(blankToNull(request.getEmail()))
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .status(UserStatus.ACTIVE)
                .build();

        UserRole userRole = UserRole.builder().user(user).role(buyerRole).build();
        user.getUserRoles().add(userRole);

        userRepository.save(user);
        return RegisterResponse.builder()
                .userId(user.getId())
                .role(RoleName.BUYER.name())
                .build();
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid phone or password"));

        if (user.getStatus() == UserStatus.DISABLED) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Account is disabled");
        }
        clearExpiredLock(user);
        if (isLocked(user)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Account is temporarily locked");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            handleFailedLogin(user);
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid phone or password");
        }

        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        return issueTokenPair(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String hash = HashUtils.sha256(request.getRefreshToken());
        RefreshToken existing = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid refresh token"));

        if (!existing.isActive()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Refresh token expired or revoked");
        }

        User user = existing.getUser();
        existing.setRevokedAt(Instant.now());
        refreshTokenRepository.save(existing);

        return issueTokenPair(user, existing.getId());
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        String hash = HashUtils.sha256(request.getRefreshToken());
        refreshTokenRepository.findByTokenHash(hash).ifPresent(token -> {
            token.setRevokedAt(Instant.now());
            refreshTokenRepository.save(token);
        });
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        Instant oneHourAgo = Instant.now().minus(1, ChronoUnit.HOURS);
        long recentCount = passwordResetOtpRepository.countByPhoneSince(request.getPhone(), oneHourAgo);
        if (recentCount >= otpProperties.getMaxRequestsPerHour()) {
            throw new BusinessException(ErrorCode.RATE_LIMITED, "Too many OTP requests. Try again later.");
        }

        userRepository.findByPhone(request.getPhone()).ifPresent(user -> {
            String otp = HashUtils.randomNumericOtp(6);
            PasswordResetOtp entity = PasswordResetOtp.builder()
                    .phone(user.getPhone())
                    .otpHash(HashUtils.sha256(otp))
                    .expiresAt(Instant.now().plus(otpProperties.getExpirationMinutes(), ChronoUnit.MINUTES))
                    .build();
            passwordResetOtpRepository.save(entity);
            log.info("Password reset OTP for {}: {} (dev only — integrate MSG91 in production)", user.getPhone(), otp);
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetOtp otpRecord = passwordResetOtpRepository
                .findFirstByPhoneAndUsedAtIsNullOrderByCreatedAtDesc(request.getPhone())
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid or expired OTP"));

        if (!otpRecord.isUsable()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid or expired OTP");
        }
        if (otpRecord.getAttempts() >= otpProperties.getMaxVerifyAttempts()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "OTP verification locked");
        }

        if (!HashUtils.sha256(request.getOtp()).equals(otpRecord.getOtpHash())) {
            otpRecord.setAttempts(otpRecord.getAttempts() + 1);
            passwordResetOtpRepository.save(otpRecord);
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid OTP");
        }

        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        otpRecord.setUsedAt(Instant.now());
        passwordResetOtpRepository.save(otpRecord);
        revokeActiveRefreshTokens(user.getId());
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Current password is incorrect");
        }
        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "New password must be different from current password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        userRepository.save(user);
        revokeActiveRefreshTokens(userId);
    }

    private void revokeActiveRefreshTokens(UUID userId) {
        Instant now = Instant.now();
        for (RefreshToken token : refreshTokenRepository.findByUser_IdAndRevokedAtIsNull(userId)) {
            token.setRevokedAt(now);
            refreshTokenRepository.save(token);
        }
    }

    private AuthResponse issueTokenPair(User user) {
        return issueTokenPair(user, null);
    }

    private AuthResponse issueTokenPair(User user, java.util.UUID replacedBy) {
        List<String> roles = user.getUserRoles().stream()
                .map(ur -> ur.getRole().getName().name())
                .toList();

        String accessToken = jwtService.generateAccessToken(user.getId(), user.getPhone(), roles);
        String refreshTokenRaw = HashUtils.randomToken();

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(HashUtils.sha256(refreshTokenRaw))
                .expiresAt(jwtService.refreshTokenExpiresAt())
                .replacedBy(replacedBy)
                .build();
        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenRaw)
                .expiresIn(jwtService.accessTokenExpiresInSeconds())
                .userId(user.getId())
                .roles(roles)
                .build();
    }

    private boolean isLocked(User user) {
        return user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now());
    }

    private void clearExpiredLock(User user) {
        if (user.getLockedUntil() != null && !user.getLockedUntil().isAfter(Instant.now())) {
            user.setLockedUntil(null);
            user.setFailedLoginCount(0);
        }
    }

    private void handleFailedLogin(User user) {
        int attempts = user.getFailedLoginCount() + 1;
        user.setFailedLoginCount(attempts);
        if (attempts >= loginProperties.getMaxFailedAttempts()) {
            user.setLockedUntil(Instant.now().plus(loginProperties.getLockDurationMinutes(), ChronoUnit.MINUTES));
        }
        userRepository.save(user);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

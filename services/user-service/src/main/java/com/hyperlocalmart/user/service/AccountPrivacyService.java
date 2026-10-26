package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.request.DeleteAccountRequest;
import com.hyperlocalmart.user.dto.request.UpdatePrivacyPreferencesRequest;
import com.hyperlocalmart.user.dto.response.UserProfileResponse;
import com.hyperlocalmart.user.entity.RefreshToken;
import com.hyperlocalmart.user.entity.RoleName;
import com.hyperlocalmart.user.entity.User;
import com.hyperlocalmart.user.entity.UserRole;
import com.hyperlocalmart.user.entity.UserStatus;
import com.hyperlocalmart.user.repository.AddressRepository;
import com.hyperlocalmart.user.repository.RefreshTokenRepository;
import com.hyperlocalmart.user.repository.UserRepository;
import com.hyperlocalmart.user.security.HashUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AccountPrivacyService {

    private static final Set<RoleName> BUYER_ONLY = Set.of(RoleName.BUYER);

    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserService userService;

    @Transactional
    public UserProfileResponse updatePrivacyPreferences(UUID userId, UpdatePrivacyPreferencesRequest request) {
        if (request.getMarketingConsent() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "No privacy fields to update");
        }
        User user = loadActiveUser(userId);
        user.setMarketingConsent(Boolean.TRUE.equals(request.getMarketingConsent()));
        user.setMarketingConsentAt(Instant.now());
        userRepository.save(user);
        return userService.getProfile(userId);
    }

    @Transactional
    public void deleteBuyerAccount(UUID userId, DeleteAccountRequest request) {
        User user = loadActiveUser(userId);
        assertBuyerOnly(user);
        if (user.getAccountDeletedAt() != null) {
            throw new BusinessException(ErrorCode.CONFLICT, "Account already deleted");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid password");
        }

        addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(userId)
                .forEach(addressRepository::delete);

        Instant now = Instant.now();
        user.setPhone(deletedPhoneMarker(user.getId()));
        user.setEmail(null);
        user.setFirstName("Deleted");
        user.setLastName("User");
        user.setPasswordHash(passwordEncoder.encode(HashUtils.randomToken()));
        user.setDefaultTownId(null);
        user.setStatus(UserStatus.DISABLED);
        user.setAccountDeletedAt(now);
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        userRepository.save(user);
        revokeRefreshTokens(userId, now);
    }

    private User loadActiveUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
        if (user.getStatus() == UserStatus.DISABLED && user.getAccountDeletedAt() != null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Account not found");
        }
        return user;
    }

    private static void assertBuyerOnly(User user) {
        Set<RoleName> roles = user.getUserRoles().stream()
                .map(UserRole::getRole)
                .map(r -> r.getName())
                .collect(Collectors.toSet());
        if (!roles.equals(BUYER_ONLY)) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Account deletion is only available for buyer accounts. Contact support for staff accounts.");
        }
    }

    /** 15-char unique placeholder: DEL + last 12 hex chars of user id. */
    private static String deletedPhoneMarker(UUID userId) {
        String hex = userId.toString().replace("-", "");
        return "DEL" + hex.substring(hex.length() - 12);
    }

    private void revokeRefreshTokens(UUID userId, Instant now) {
        for (RefreshToken token : refreshTokenRepository.findByUser_IdAndRevokedAtIsNull(userId)) {
            token.setRevokedAt(now);
            refreshTokenRepository.save(token);
        }
    }
}

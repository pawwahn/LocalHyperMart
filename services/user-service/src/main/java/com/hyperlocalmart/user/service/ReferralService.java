package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.client.OrderReferralClient;
import com.hyperlocalmart.user.client.PaymentWalletClient;
import com.hyperlocalmart.user.client.TownPlatformClient;
import com.hyperlocalmart.user.dto.response.ReferralMeResponse;
import com.hyperlocalmart.user.dto.response.ReferralValidateResponse;
import com.hyperlocalmart.user.entity.ReferralAttribution;
import com.hyperlocalmart.user.entity.ReferralCode;
import com.hyperlocalmart.user.repository.ReferralAttributionRepository;
import com.hyperlocalmart.user.repository.ReferralCodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReferralService {

    public static final String REF_TYPE_REFEREE = "REFERRAL_REFEREE";
    public static final String REF_TYPE_REFERRER = "REFERRAL_REFERRER";

    private final ReferralCodeRepository referralCodeRepository;
    private final ReferralAttributionRepository referralAttributionRepository;
    private final TownPlatformClient townPlatformClient;
    private final PaymentWalletClient paymentWalletClient;
    private final OrderReferralClient orderReferralClient;

    @Transactional(readOnly = true)
    public boolean mayRegisterWithReferralCode(String code) {
        if (!StringUtils.hasText(code)) {
            return false;
        }
        TownPlatformClient.ReferralConfig config = townPlatformClient.getReferralConfig();
        if (!config.isEnabled()) {
            return false;
        }
        return referralCodeRepository.findByCodeIgnoreCase(normalize(code)).isPresent();
    }

    @Transactional
    public void applyAtRegistration(UUID refereeUserId, String code) {
        if (!StringUtils.hasText(code)) {
            return;
        }
        applyAttribution(refereeUserId, code);
    }

    @Transactional
    public void applyAtCart(UUID refereeUserId, String code) {
        applyAttribution(refereeUserId, code);
    }

    @Transactional
    public void onOrderDelivered(UUID refereeUserId, UUID orderId) {
        TownPlatformClient.ReferralConfig config = townPlatformClient.getReferralConfig();
        if (!config.isEnabled()) {
            return;
        }
        ReferralAttribution row = referralAttributionRepository.findByRefereeUserId(refereeUserId).orElse(null);
        if (row == null || row.isReferrerRewardCredited()) {
            return;
        }
        try {
            paymentWalletClient.credit(
                    row.getReferrerUserId(),
                    config.getReferrerRewardAmount(),
                    REF_TYPE_REFERRER,
                    row.getId(),
                    orderId,
                    "Referral reward — friend's order delivered");
            row.setReferrerRewardCredited(true);
            row.setQualifyingOrderId(orderId);
            row.setReferrerCreditedAt(Instant.now());
            referralAttributionRepository.save(row);
        } catch (Exception ex) {
            log.warn("Referral referrer wallet credit failed for order {}: {}", orderId, ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public ReferralValidateResponse validate(String code) {
        TownPlatformClient.ReferralConfig config = townPlatformClient.getReferralConfig();
        if (!config.isEnabled() || !StringUtils.hasText(code)) {
            return ReferralValidateResponse.builder()
                    .programEnabled(config.isEnabled())
                    .valid(false)
                    .build();
        }
        boolean valid = referralCodeRepository.findByCodeIgnoreCase(normalize(code)).isPresent();
        return ReferralValidateResponse.builder().programEnabled(true).valid(valid).build();
    }

    @Transactional
    public ReferralMeResponse getMe(UUID userId) {
        TownPlatformClient.ReferralConfig config = townPlatformClient.getReferralConfig();
        String code = ensureCode(userId);
        String link = buildShareLink(config.getShareBaseUrl(), code);
        String message = buildShareMessage(config.getShareMessageTemplate(), code, link);
        var attr = referralAttributionRepository.findByRefereeUserId(userId);
        return ReferralMeResponse.builder()
                .programEnabled(config.isEnabled())
                .code(code)
                .shareLink(link)
                .shareMessage(message)
                .referrerRewardAmount(config.getReferrerRewardAmount())
                .refereeRewardAmount(config.getRefereeRewardAmount())
                .hasAppliedCode(attr.isPresent())
                .appliedCode(attr.map(ReferralAttribution::getReferralCode).orElse(null))
                .build();
    }

    private void applyAttribution(UUID refereeUserId, String code) {
        TownPlatformClient.ReferralConfig config = townPlatformClient.getReferralConfig();
        if (!config.isEnabled()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Referrals are not available");
        }
        String normalized = normalize(code);
        ReferralCode refCode = referralCodeRepository.findByCodeIgnoreCase(normalized)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid referral code"));
        if (refCode.getUserId().equals(refereeUserId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "You cannot use your own referral code");
        }
        if (referralAttributionRepository.existsByRefereeUserId(refereeUserId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Referral code already applied");
        }
        if (orderReferralClient.buyerHasDeliveredOrder(refereeUserId)) {
            throw new BusinessException(
                    ErrorCode.CONFLICT, "Referral code must be applied before your first delivery");
        }
        ReferralAttribution row = ReferralAttribution.builder()
                .refereeUserId(refereeUserId)
                .referrerUserId(refCode.getUserId())
                .referralCode(normalized)
                .refereeRewardCredited(false)
                .referrerRewardCredited(false)
                .createdAt(Instant.now())
                .build();
        referralAttributionRepository.save(row);
        creditReferee(row, config);
    }

    private void creditReferee(ReferralAttribution row, TownPlatformClient.ReferralConfig config) {
        if (row.isRefereeRewardCredited()) {
            return;
        }
        try {
            paymentWalletClient.credit(
                    row.getRefereeUserId(),
                    config.getRefereeRewardAmount(),
                    REF_TYPE_REFEREE,
                    row.getId(),
                    null,
                    "Referral welcome credit");
            row.setRefereeRewardCredited(true);
            referralAttributionRepository.save(row);
        } catch (Exception ex) {
            log.warn("Referral referee wallet credit failed for {}: {}", row.getRefereeUserId(), ex.getMessage());
        }
    }

    private String ensureCode(UUID userId) {
        return referralCodeRepository.findById(userId)
                .map(ReferralCode::getCode)
                .orElseGet(() -> createCode(userId));
    }

    private String createCode(UUID userId) {
        for (int i = 0; i < 20; i++) {
            String candidate = "HLM"
                    + UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
            if (!referralCodeRepository.existsByCodeIgnoreCase(candidate)) {
                ReferralCode row = ReferralCode.builder()
                        .userId(userId)
                        .code(candidate)
                        .createdAt(Instant.now())
                        .build();
                referralCodeRepository.save(row);
                return candidate;
            }
        }
        throw new IllegalStateException("Could not allocate referral code");
    }

    private static String normalize(String code) {
        return code.trim().toUpperCase();
    }

    private static String buildShareLink(String baseUrl, String code) {
        String base = baseUrl == null ? "" : baseUrl.trim();
        if (base.isEmpty()) {
            return "?ref=" + code;
        }
        String sep = base.contains("?") ? "&" : "?";
        return base + sep + "ref=" + code;
    }

    private static String buildShareMessage(String template, String code, String link) {
        String tpl = template == null || template.isBlank()
                ? "Order from local shops on KoYaKart. Code {code}: {link}"
                : template;
        return tpl.replace("{code}", code).replace("{link}", link);
    }
}

package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.client.PaymentWalletClient;
import com.hyperlocalmart.user.client.TownPlatformClient;
import com.hyperlocalmart.user.dto.response.ReferralReportResponse;
import com.hyperlocalmart.user.dto.response.ReferralReportResponse.Candidate;
import com.hyperlocalmart.user.dto.response.ReferralReportResponse.Line;
import com.hyperlocalmart.user.entity.ReferralAttribution;
import com.hyperlocalmart.user.entity.User;
import com.hyperlocalmart.user.repository.ReferralAttributionRepository;
import com.hyperlocalmart.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReferralReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;

    private final ReferralAttributionRepository referralAttributionRepository;
    private final UserRepository userRepository;
    private final TownPlatformClient townPlatformClient;
    private final PaymentWalletClient paymentWalletClient;

    @Transactional(readOnly = true)
    public ReferralReportResponse getReport(LocalDate from, LocalDate to) {
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo.minusDays(29);
        if (rangeFrom.isAfter(rangeTo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "from must be on or before to");
        }
        if (ChronoUnit.DAYS.between(rangeFrom, rangeTo) + 1 > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }

        Instant start = rangeFrom.atStartOfDay(IST).toInstant();
        Instant end = rangeTo.plusDays(1).atStartOfDay(IST).toInstant();
        TownPlatformClient.ReferralConfig config = townPlatformClient.getReferralConfig();
        BigDecimal referrerRate = money(config.getReferrerRewardAmount());
        BigDecimal refereeRate = money(config.getRefereeRewardAmount());

        List<ReferralAttribution> rows = referralAttributionRepository.findCreatedBetween(start, end);
        Set<UUID> userIds = new HashSet<>();
        List<UUID> attributionIds = new ArrayList<>();
        for (ReferralAttribution row : rows) {
            userIds.add(row.getReferrerUserId());
            userIds.add(row.getRefereeUserId());
            attributionIds.add(row.getId());
        }
        Map<UUID, User> users = new HashMap<>();
        if (!userIds.isEmpty()) {
            for (User user : userRepository.findAllById(userIds)) {
                users.put(user.getId(), user);
            }
        }
        Map<String, BigDecimal> wallet = paymentWalletClient.lookupCredits(
                List.of(ReferralService.REF_TYPE_REFEREE, ReferralService.REF_TYPE_REFERRER),
                attributionIds);
        boolean amountsFromWallet = !wallet.isEmpty();

        long referrerRewarded = 0;
        long refereeRewarded = 0;
        long pendingReferrer = 0;
        long pendingReferee = 0;
        Set<UUID> referrers = new HashSet<>();
        Map<UUID, CandAcc> byReferrer = new HashMap<>();
        List<Line> lines = new ArrayList<>();
        BigDecimal spentOnReferrers = BigDecimal.ZERO;
        BigDecimal spentOnReferees = BigDecimal.ZERO;
        BigDecimal companyPending = BigDecimal.ZERO;

        for (ReferralAttribution row : rows) {
            referrers.add(row.getReferrerUserId());
            boolean refereePaid = row.isRefereeRewardCredited();
            boolean referrerPaid = row.isReferrerRewardCredited();
            if (refereePaid) {
                refereeRewarded++;
            } else {
                pendingReferee++;
            }
            if (referrerPaid) {
                referrerRewarded++;
            } else {
                pendingReferrer++;
            }

            BigDecimal refereeAmt = paidAmount(
                    wallet, ReferralService.REF_TYPE_REFEREE, row.getId(), refereePaid, refereeRate, amountsFromWallet);
            BigDecimal referrerAmt = paidAmount(
                    wallet, ReferralService.REF_TYPE_REFERRER, row.getId(), referrerPaid, referrerRate, amountsFromWallet);
            BigDecimal pending = BigDecimal.ZERO;
            if (!refereePaid) {
                pending = pending.add(refereeRate);
            }
            if (!referrerPaid) {
                pending = pending.add(referrerRate);
            }
            spentOnReferees = spentOnReferees.add(refereeAmt);
            spentOnReferrers = spentOnReferrers.add(referrerAmt);
            companyPending = companyPending.add(pending);

            User referrer = users.get(row.getReferrerUserId());
            User referee = users.get(row.getRefereeUserId());
            lines.add(Line.builder()
                    .attributionId(row.getId())
                    .createdAt(istDate(row.getCreatedAt()))
                    .code(row.getReferralCode())
                    .referrerUserId(row.getReferrerUserId())
                    .referrerName(displayName(referrer))
                    .referrerPhone(phoneOf(referrer))
                    .refereeUserId(row.getRefereeUserId())
                    .refereeName(displayName(referee))
                    .refereePhone(phoneOf(referee))
                    .refereePaid(refereePaid)
                    .refereeAmount(refereeAmt)
                    .referrerPaid(referrerPaid)
                    .referrerAmount(referrerAmt)
                    .companySpent(money(refereeAmt.add(referrerAmt)))
                    .companyPending(money(pending))
                    .qualifyingOrderId(row.getQualifyingOrderId())
                    .referrerPaidAt(istDate(row.getReferrerCreditedAt()))
                    .build());

            CandAcc acc = byReferrer.computeIfAbsent(row.getReferrerUserId(), id -> new CandAcc());
            acc.referred++;
            if (referrerPaid) {
                acc.converted++;
            }
            if (refereePaid) {
                acc.refereePaid++;
            }
            acc.earned = acc.earned.add(referrerAmt);
            acc.spent = acc.spent.add(refereeAmt).add(referrerAmt);
            acc.pending = acc.pending.add(pending);
            acc.code = row.getReferralCode();
        }

        List<Candidate> candidates = new ArrayList<>();
        for (Map.Entry<UUID, CandAcc> e : byReferrer.entrySet()) {
            User referrer = users.get(e.getKey());
            CandAcc acc = e.getValue();
            candidates.add(Candidate.builder()
                    .userId(e.getKey())
                    .name(displayName(referrer))
                    .phone(phoneOf(referrer))
                    .code(acc.code)
                    .referred(acc.referred)
                    .converted(acc.converted)
                    .refereePaid(acc.refereePaid)
                    .earned(money(acc.earned))
                    .companySpent(money(acc.spent))
                    .companyPending(money(acc.pending))
                    .build());
        }
        candidates.sort(Comparator
                .comparing(Candidate::getCompanySpent).reversed()
                .thenComparing(Comparator.comparingLong(Candidate::getReferred).reversed()));

        BigDecimal companySpent = money(spentOnReferrers.add(spentOnReferees));
        return ReferralReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .programEnabled(config.isEnabled())
                .referrerRewardAmount(referrerRate)
                .refereeRewardAmount(refereeRate)
                .amountsFromWallet(amountsFromWallet)
                .signups(rows.size())
                .uniqueReferrers(referrers.size())
                .converted(referrerRewarded)
                .referrerRewarded(referrerRewarded)
                .refereeRewarded(refereeRewarded)
                .pendingReferrer(pendingReferrer)
                .pendingReferee(pendingReferee)
                .spentOnReferrers(money(spentOnReferrers))
                .spentOnReferees(money(spentOnReferees))
                .companySpent(companySpent)
                .companyPending(money(companyPending))
                .companyIfAllPaid(money(companySpent.add(companyPending)))
                .candidates(candidates)
                .lines(lines)
                .build();
    }

    private static BigDecimal paidAmount(
            Map<String, BigDecimal> wallet,
            String type,
            UUID attributionId,
            boolean paid,
            BigDecimal rate,
            boolean amountsFromWallet) {
        if (!paid) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (amountsFromWallet) {
            BigDecimal actual = wallet.get(type + "|" + attributionId);
            if (actual != null) {
                return money(actual);
            }
        }
        return money(rate);
    }

    private static String displayName(User user) {
        if (user == null) {
            return "Unknown";
        }
        String first = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String last = user.getLastName() == null ? "" : user.getLastName().trim();
        String name = (first + " " + last).trim();
        if (!name.isEmpty()) {
            return name;
        }
        return phoneOf(user);
    }

    private static String phoneOf(User user) {
        return user == null || user.getPhone() == null ? "" : user.getPhone();
    }

    private static String istDate(Instant instant) {
        if (instant == null) {
            return "";
        }
        return instant.atZone(IST).toLocalDate().toString();
    }

    private static BigDecimal money(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }

    private static class CandAcc {
        String code = "";
        long referred;
        long converted;
        long refereePaid;
        BigDecimal earned = BigDecimal.ZERO;
        BigDecimal spent = BigDecimal.ZERO;
        BigDecimal pending = BigDecimal.ZERO;
    }
}

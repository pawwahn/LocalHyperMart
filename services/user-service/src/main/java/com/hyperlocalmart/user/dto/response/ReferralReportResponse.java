package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class ReferralReportResponse {
    LocalDate from;
    LocalDate to;
    boolean programEnabled;
    BigDecimal referrerRewardAmount;
    BigDecimal refereeRewardAmount;
    boolean amountsFromWallet;

    long signups;
    long uniqueReferrers;
    long converted;
    long referrerRewarded;
    long refereeRewarded;
    long pendingReferrer;
    long pendingReferee;

    BigDecimal spentOnReferrers;
    BigDecimal spentOnReferees;
    BigDecimal companySpent;
    BigDecimal companyPending;
    BigDecimal companyIfAllPaid;

    List<Candidate> candidates;
    List<Line> lines;

    @Value
    @Builder
    public static class Candidate {
        UUID userId;
        String name;
        String phone;
        String code;
        long referred;
        long converted;
        long refereePaid;
        BigDecimal earned;
        BigDecimal companySpent;
        BigDecimal companyPending;
    }

    @Value
    @Builder
    public static class Line {
        UUID attributionId;
        String createdAt;
        String code;
        UUID referrerUserId;
        String referrerName;
        String referrerPhone;
        UUID refereeUserId;
        String refereeName;
        String refereePhone;
        boolean refereePaid;
        BigDecimal refereeAmount;
        boolean referrerPaid;
        BigDecimal referrerAmount;
        BigDecimal companySpent;
        BigDecimal companyPending;
        UUID qualifyingOrderId;
        String referrerPaidAt;
    }
}

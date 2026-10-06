package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.response.MoneyAssuranceReportResponse;
import com.hyperlocalmart.payment.dto.response.MoneyAssuranceReportResponse.AgingBucket;
import com.hyperlocalmart.payment.dto.response.MoneyAssuranceReportResponse.UnpaidLine;
import com.hyperlocalmart.payment.entity.Settlement;
import com.hyperlocalmart.payment.repository.SettlementRepository;
import com.hyperlocalmart.payment.repository.WalletAccountRepository;
import com.hyperlocalmart.payment.repository.WalletTransactionRepository;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MoneyAssuranceReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;

    private final SettlementRepository settlementRepository;
    private final WalletAccountRepository walletAccountRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final PayeeDisplayNameService payeeDisplayNameService;

    @Transactional(readOnly = true)
    public MoneyAssuranceReportResponse getReport(UUID townId, LocalDate from, LocalDate to) {
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
        Instant now = Instant.now();

        List<Settlement> unpaid = settlementRepository.findUnpaidPayouts(townId);
        AgingAcc d0 = new AgingAcc();
        AgingAcc d8 = new AgingAcc();
        AgingAcc d15 = new AgingAcc();
        AgingAcc d31 = new AgingAcc();
        BigDecimal unpaidAmount = BigDecimal.ZERO;
        List<SettlementAgingRow> agingRows = new ArrayList<>();
        for (Settlement s : unpaid) {
            Instant created = s.getCreatedAt() != null ? s.getCreatedAt() : now;
            int age = (int) Math.max(0, ChronoUnit.DAYS.between(created, now));
            BigDecimal net = money(s.getNetAmount());
            unpaidAmount = unpaidAmount.add(net);
            if (age <= 7) {
                d0.add(net);
            } else if (age <= 14) {
                d8.add(net);
            } else if (age <= 30) {
                d15.add(net);
            } else {
                d31.add(net);
            }
            agingRows.add(new SettlementAgingRow(s, age, net));
        }
        agingRows.sort(Comparator.comparingInt(SettlementAgingRow::ageDays).reversed());
        List<UnpaidLine> oldest = new ArrayList<>();
        for (SettlementAgingRow row : agingRows.stream().limit(25).toList()) {
            Settlement s = row.settlement();
            oldest.add(UnpaidLine.builder()
                    .settlementId(s.getId())
                    .payeeType(s.getPayeeType() != null ? s.getPayeeType().name() : "UNKNOWN")
                    .payeeName(payeeDisplayNameService.forSettlement(s))
                    .status(s.getStatus() != null ? s.getStatus().name() : "UNKNOWN")
                    .ageDays(row.ageDays())
                    .netAmount(row.net())
                    .periodEnd(s.getPeriodEnd())
                    .build());
        }

        Map<String, ReasonAcc> byReason = new LinkedHashMap<>();
        for (Object[] row : walletTransactionRepository.sumByReferenceTypeInRange("CREDIT", start, end)) {
            String name = row[0] == null ? "UNKNOWN" : String.valueOf(row[0]);
            ReasonAcc acc = new ReasonAcc();
            acc.name = name;
            acc.count = row[1] instanceof Number n ? n.longValue() : 0L;
            acc.amount = money(row[2] instanceof BigDecimal bd ? bd : BigDecimal.ZERO);
            byReason.put(name, acc);
        }

        return MoneyAssuranceReportResponse.builder()
                .from(rangeFrom)
                .to(rangeTo)
                .townId(townId)
                .unpaidPayouts(unpaid.size())
                .unpaidPayoutAmount(money(unpaidAmount))
                .aging(List.of(
                        bucket("0-7 days", d0),
                        bucket("8-14 days", d8),
                        bucket("15-30 days", d15),
                        bucket("31+ days", d31)))
                .oldestUnpaid(oldest)
                .walletLiability(money(walletAccountRepository.sumPositiveBalances()))
                .walletsWithBalance(walletAccountRepository.countPositiveBalances())
                .walletCreditsInRange(money(walletTransactionRepository.sumByTypeInRange("CREDIT", start, end)))
                .walletCreditCount(walletTransactionRepository.countByTypeInRange("CREDIT", start, end))
                .walletDebitsInRange(money(walletTransactionRepository.sumByTypeInRange("DEBIT", start, end)))
                .walletDebitCount(walletTransactionRepository.countByTypeInRange("DEBIT", start, end))
                .walletScratch(money(byReason.get("SCRATCH_CARD") == null ? BigDecimal.ZERO : byReason.get("SCRATCH_CARD").amount))
                .walletReferral(money(reasonSum(byReason, "REFERRAL_REFEREE", "REFERRAL_REFERRER")))
                .walletStoreCredit(money(reasonSum(byReason, "ORDER_ITEM_CANCEL")))
                .walletCreditsByReason(byReason.values().stream()
                        .sorted((a, b) -> b.amount.compareTo(a.amount))
                        .map(r -> MoneyAssuranceReportResponse.NamedAmount.builder()
                                .name(r.name)
                                .count(r.count)
                                .amount(money(r.amount))
                                .build())
                        .toList())
                .build();
    }

    private static AgingBucket bucket(String label, AgingAcc acc) {
        return AgingBucket.builder()
                .label(label)
                .count(acc.count)
                .amount(money(acc.amount))
                .build();
    }

    private static BigDecimal reasonSum(Map<String, ReasonAcc> map, String... keys) {
        BigDecimal total = BigDecimal.ZERO;
        for (String key : keys) {
            ReasonAcc acc = map.get(key);
            if (acc != null) {
                total = total.add(acc.amount);
            }
        }
        return total;
    }

    private static BigDecimal money(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }

    private static class ReasonAcc {
        String name;
        long count;
        BigDecimal amount = BigDecimal.ZERO;
    }

    private static class AgingAcc {
        long count;
        BigDecimal amount = BigDecimal.ZERO;

        void add(BigDecimal net) {
            count++;
            amount = amount.add(net);
        }
    }

    private record SettlementAgingRow(Settlement settlement, int ageDays, BigDecimal net) {
    }
}

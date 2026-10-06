package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.DeliveryClient;
import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.dto.response.CodCustodianOutstandingResponse;
import com.hyperlocalmart.payment.dto.response.CodHubLedgerResponse;
import com.hyperlocalmart.payment.dto.response.DeliverySettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.HubAccountSummaryResponse;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.entity.SettlementDirection;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HubAccountSummaryService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    /** Include every unpaid trip in range so hub Due matches the line list. */
    private static final int UNPAID_CAP = 500;

    private final DeliveryClient deliveryClient;
    private final TownClient townClient;
    private final DeliverySettlementService deliverySettlementService;
    private final SettlementService settlementService;
    private final CodCustodianReceivableService codCustodianReceivableService;
    private final CodHubLedgerService codHubLedgerService;
    private final HubPlatformPaymentSubmissionService hubPlatformPaymentSubmissionService;

    @Transactional(readOnly = true)
    public HubAccountSummaryResponse summary(UUID hubAdminUserId, LocalDate from, LocalDate to) {
        DeliveryClient.HubAdminContext hub = deliveryClient.getHubAdminContext(hubAdminUserId);
        LocalDate today = LocalDate.now(IST);
        LocalDate start = from != null ? from : today.withDayOfMonth(1);
        LocalDate end = to != null ? to : today;
        if (end.isBefore(start)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid date range");
        }

        TownClient.DeliveryPayoutConfig.Party party = null;
        try {
            TownClient.DeliveryPayoutConfig cfg = townClient.deliveryPayoutConfig(hub.townId());
            party = cfg == null ? null : cfg.hub();
        } catch (RuntimeException ignored) {
            // rates may be unavailable
        }

        boolean commissionEnabled = party != null && party.enabled()
                && party.perOrder() != null && party.perOrder().enabled();

        DeliverySettlementCandidateView candidates = deliverySettlementService.listCandidates(
                hub.townId(), SettlementPayeeType.HUB, hub.hubId(), start, end);

        DeliverySettlementCandidateView.FranchiseDue franchise = candidates.getFranchise();
        boolean franchiseEnabled = franchise != null && franchise.isEnabled();
        BigDecimal franchiseAmount = franchiseEnabled ? money(franchise.getAmount()) : BigDecimal.ZERO;

        BigDecimal earned = BigDecimal.ZERO;
        BigDecimal dueUnpaid = BigDecimal.ZERO;
        long payable = 0;
        long settled = 0;
        long delivered = 0;
        List<HubAccountSummaryResponse.UnpaidOrder> earnedAll = new ArrayList<>();
        List<HubAccountSummaryResponse.UnpaidOrder> unpaidAll = new ArrayList<>();
        Map<UUID, DeliverySettlementCandidateView.Item> byOrder = new HashMap<>();

        for (DeliverySettlementCandidateView.Item item : candidates.getItems()) {
            if (item.getOrderId() != null) {
                byOrder.put(item.getOrderId(), item);
            }
            if (item.isLastMileCompleted() || item.isPickupCompleted()) {
                delivered++;
            }
            if (item.getSkipReason() != null) {
                continue;
            }
            payable++;
            BigDecimal amount = money(item.getAmount());
            earned = earned.add(amount);
            earnedAll.add(toTrip(item, amount, item.isAlreadySettled(), null, null));
            if (item.isAlreadySettled()) {
                settled++;
            } else {
                dueUnpaid = dueUnpaid.add(amount);
                unpaidAll.add(toTrip(item, amount, false, null, null));
            }
        }

        List<SettlementResponse> settlements = settlementService.list(
                hub.townId(), SettlementPayeeType.HUB, hub.hubId(), null);

        List<SettlementResponse> paidPayouts = settlements.stream()
                .filter(row -> row.getDirection() == SettlementDirection.PAYOUT)
                .filter(row -> row.getStatus() == SettlementStatus.PAID)
                .filter(row -> overlaps(row, start, end))
                .sorted(Comparator.comparing(SettlementResponse::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        List<HubAccountSummaryResponse.MoneyMovement> payoutsFromPlatform = paidPayouts.stream()
                .map(this::toPayoutMovement)
                .toList();

        List<HubAccountSummaryResponse.UnpaidOrder> paidAll = paidOrdersFromPayouts(paidPayouts, byOrder);
        if (paidAll.isEmpty()) {
            for (DeliverySettlementCandidateView.Item item : candidates.getItems()) {
                if (item.getSkipReason() != null || !item.isAlreadySettled()) {
                    continue;
                }
                paidAll.add(toTrip(item, money(item.getAmount()), true, null, null));
            }
        }
        Map<UUID, HubAccountSummaryResponse.UnpaidOrder> paidByOrder = new HashMap<>();
        for (HubAccountSummaryResponse.UnpaidOrder paid : paidAll) {
            if (paid.getOrderId() != null) {
                paidByOrder.put(paid.getOrderId(), paid);
            }
        }
        for (int i = 0; i < earnedAll.size(); i++) {
            HubAccountSummaryResponse.UnpaidOrder earnedRow = earnedAll.get(i);
            HubAccountSummaryResponse.UnpaidOrder paid = earnedRow.getOrderId() == null
                    ? null : paidByOrder.get(earnedRow.getOrderId());
            if (paid == null) {
                continue;
            }
            earnedAll.set(i, HubAccountSummaryResponse.UnpaidOrder.builder()
                    .orderId(earnedRow.getOrderId())
                    .orderNumber(earnedRow.getOrderNumber())
                    .deliveredAt(earnedRow.getDeliveredAt())
                    .amount(earnedRow.getAmount())
                    .pickupCompleted(earnedRow.isPickupCompleted())
                    .lastMileCompleted(earnedRow.isLastMileCompleted())
                    .settled(true)
                    .reference(paid.getReference())
                    .paidAt(paid.getPaidAt())
                    .build());
        }

        // Paid = money actually received (UTR / settlement net), not settled trips re-priced at today's rates.
        BigDecimal commissionPaid = payoutsFromPlatform.stream()
                .map(HubAccountSummaryResponse.MoneyMovement::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal commissionDue = dueUnpaid.setScale(2, RoundingMode.HALF_UP);

        List<HubAccountSummaryResponse.MoneyMovement> collectionsByPlatform = settlements.stream()
                .filter(row -> row.getDirection() == SettlementDirection.COLLECTION)
                .filter(row -> overlaps(row, start, end))
                .sorted(Comparator.comparing(SettlementResponse::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toCollectionMovement)
                .toList();

        CodCustodianOutstandingResponse codOutstanding =
                codCustodianReceivableService.outstanding(hub.townId(), hub.hubId(), null);
        CodHubLedgerResponse ledger = codHubLedgerService.ledger(
                hub.townId(), hub.hubId(), start, end, hubAdminUserId, false);

        var platformPayable = hubPlatformPaymentSubmissionService.payable(hubAdminUserId);
        var submissions = hubPlatformPaymentSubmissionService.listForHub(hubAdminUserId);
        var pending = submissions.stream()
                .filter(s -> "PENDING_VERIFICATION".equals(s.getStatus()))
                .findFirst()
                .orElse(null);

        boolean franchisePending = platformPayable.isFranchisePendingVerification();

        return HubAccountSummaryResponse.builder()
                .hubId(hub.hubId())
                .hubName(null)
                .townId(hub.townId())
                .from(start.toString())
                .to(end.toString())
                .hubPayoutModel(candidates.getHubPayoutModel())
                .commissionEnabled(commissionEnabled)
                .pickupRate(rate(party, true))
                .lastMileRate(rate(party, false))
                .completedOrderRate(completedRate(party))
                .deliveredOrdersInRange(delivered)
                .payableOrderCount(payable)
                .unpaidOrderCount(Math.max(0, payable - settled))
                .commissionEarned(earned.setScale(2, RoundingMode.HALF_UP))
                .commissionPaid(commissionPaid)
                .commissionDue(commissionDue)
                .earnedOrderCount(earnedAll.size())
                .paidOrderCount(paidAll.size())
                .earnedOrders(cappedSorted(earnedAll))
                .paidOrders(cappedSorted(paidAll))
                .unpaidOrders(cappedSorted(unpaidAll))
                .payoutsFromPlatform(payoutsFromPlatform)
                .franchiseEnabled(franchiseEnabled)
                .franchiseAmount(franchiseAmount)
                .franchiseCollected(franchiseEnabled && franchise != null && franchise.isAlreadyCollected())
                .franchisePendingVerification(franchisePending)
                .franchiseLabel(franchiseEnabled && franchise != null ? franchise.getLabel() : null)
                .codStillWithAgents(money(codOutstanding.getTotalStillWithAgents()))
                .codDeclaredAwaitingConfirm(money(codOutstanding.getTotalDeclaredAwaitingConfirm()))
                .handoversAwaitingConfirm(codOutstanding.getHandoversAwaitingConfirm())
                .codConfirmedAtHubAllTime(money(ledger.getTotalReceivedAllTime()))
                .codRemittedToCompanyAllTime(money(ledger.getTotalRemittedAllTime()))
                .codOwedToCompany(money(ledger.getBalanceOwedToCompany()))
                .codPendingVerification(platformPayable.isCodPendingVerification())
                .collectionsByPlatform(collectionsByPlatform)
                .hasPendingPaymentSubmission(pending != null)
                .pendingPaymentStatusLabel(pending != null ? pending.getStatusLabel() : platformPayable.getPendingStatusLabel())
                .pendingPaymentTotal(pending != null ? pending.getTotalAmount() : null)
                .payableToPlatformNow(platformPayable.getSuggestedTotal())
                .recentPaymentSubmissions(submissions.size() > 8 ? submissions.subList(0, 8) : submissions)
                .build();
    }

    private HubAccountSummaryResponse.MoneyMovement toPayoutMovement(SettlementResponse row) {
        return HubAccountSummaryResponse.MoneyMovement.builder()
                .settlementId(row.getId())
                .kind("COMMISSION")
                .status(row.getStatus() == null ? "" : row.getStatus().name())
                .periodStart(row.getPeriodStart() == null ? null : row.getPeriodStart().toString())
                .periodEnd(row.getPeriodEnd() == null ? null : row.getPeriodEnd().toString())
                .amount(money(row.getNetAmount()))
                .reference(row.getTransactionReference())
                .recordedAt(row.getPaidAt() != null ? row.getPaidAt() : row.getCreatedAt())
                .orderCount(countOrderLines(row))
                .build();
    }

    private HubAccountSummaryResponse.MoneyMovement toCollectionMovement(SettlementResponse row) {
        String kind = row.getLines() != null && row.getLines().stream()
                .anyMatch(l -> "FRANCHISE".equalsIgnoreCase(l.getLineType()))
                ? "FRANCHISE"
                : "COLLECTION";
        return HubAccountSummaryResponse.MoneyMovement.builder()
                .settlementId(row.getId())
                .kind(kind)
                .status(row.getStatus() == null ? "" : row.getStatus().name())
                .periodStart(row.getPeriodStart() == null ? null : row.getPeriodStart().toString())
                .periodEnd(row.getPeriodEnd() == null ? null : row.getPeriodEnd().toString())
                .amount(money(row.getNetAmount()))
                .reference(row.getTransactionReference())
                .recordedAt(row.getPaidAt() != null ? row.getPaidAt() : row.getCreatedAt())
                .orderCount(countOrderLines(row))
                .build();
    }

    private static HubAccountSummaryResponse.UnpaidOrder toTrip(
            DeliverySettlementCandidateView.Item item,
            BigDecimal amount,
            boolean settled,
            String reference,
            Instant paidAt) {
        return HubAccountSummaryResponse.UnpaidOrder.builder()
                .orderId(item.getOrderId())
                .orderNumber(item.getOrderNumber())
                .deliveredAt(item.getDeliveredAt())
                .amount(amount)
                .pickupCompleted(item.isPickupCompleted())
                .lastMileCompleted(item.isLastMileCompleted())
                .settled(settled)
                .reference(reference)
                .paidAt(paidAt)
                .build();
    }

    private static List<HubAccountSummaryResponse.UnpaidOrder> paidOrdersFromPayouts(
            List<SettlementResponse> paidPayouts,
            Map<UUID, DeliverySettlementCandidateView.Item> byOrder) {
        Map<UUID, HubAccountSummaryResponse.UnpaidOrder> merged = new LinkedHashMap<>();
        for (SettlementResponse row : paidPayouts) {
            if (row.getLines() == null) {
                continue;
            }
            String ref = row.getTransactionReference();
            Instant when = row.getPaidAt() != null ? row.getPaidAt() : row.getCreatedAt();
            for (SettlementResponse.Line line : row.getLines()) {
                if (line.getOrderId() == null) {
                    continue;
                }
                BigDecimal add = money(line.getAmount());
                HubAccountSummaryResponse.UnpaidOrder existing = merged.get(line.getOrderId());
                if (existing != null) {
                    Instant paidAt = existing.getPaidAt();
                    if (paidAt == null || (when != null && when.isAfter(paidAt))) {
                        paidAt = when;
                    }
                    merged.put(line.getOrderId(), HubAccountSummaryResponse.UnpaidOrder.builder()
                            .orderId(existing.getOrderId())
                            .orderNumber(existing.getOrderNumber())
                            .deliveredAt(existing.getDeliveredAt())
                            .amount(existing.getAmount().add(add).setScale(2, RoundingMode.HALF_UP))
                            .pickupCompleted(existing.isPickupCompleted())
                            .lastMileCompleted(existing.isLastMileCompleted())
                            .settled(true)
                            .reference(existing.getReference() != null ? existing.getReference() : ref)
                            .paidAt(paidAt)
                            .build());
                    continue;
                }
                DeliverySettlementCandidateView.Item src = byOrder.get(line.getOrderId());
                String orderNumber = line.getOrderNumber();
                if ((orderNumber == null || orderNumber.isBlank()) && src != null) {
                    orderNumber = src.getOrderNumber();
                }
                merged.put(line.getOrderId(), HubAccountSummaryResponse.UnpaidOrder.builder()
                        .orderId(line.getOrderId())
                        .orderNumber(orderNumber)
                        .deliveredAt(src != null ? src.getDeliveredAt() : when)
                        .amount(add)
                        .pickupCompleted(src != null && src.isPickupCompleted())
                        .lastMileCompleted(src != null && src.isLastMileCompleted())
                        .settled(true)
                        .reference(ref)
                        .paidAt(when)
                        .build());
            }
        }
        return new ArrayList<>(merged.values());
    }

    private static List<HubAccountSummaryResponse.UnpaidOrder> cappedSorted(
            List<HubAccountSummaryResponse.UnpaidOrder> rows) {
        rows.sort(Comparator.comparing(
                HubAccountSummaryResponse.UnpaidOrder::getDeliveredAt,
                Comparator.nullsLast(Comparator.naturalOrder())));
        if (rows.size() <= UNPAID_CAP) {
            return List.copyOf(rows);
        }
        return List.copyOf(rows.subList(0, UNPAID_CAP));
    }

    private static int countOrderLines(SettlementResponse row) {
        if (row.getLines() == null) {
            return 0;
        }
        return (int) row.getLines().stream().filter(l -> l.getOrderId() != null).count();
    }

    private static boolean overlaps(SettlementResponse row, LocalDate from, LocalDate to) {
        LocalDate start = row.getPeriodStart();
        LocalDate end = row.getPeriodEnd();
        if (start == null || end == null) {
            return true;
        }
        return !end.isBefore(from) && !start.isAfter(to);
    }

    private static BigDecimal rate(TownClient.DeliveryPayoutConfig.Party party, boolean pickup) {
        if (party == null || party.perOrder() == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return money(pickup ? party.perOrder().pickupAmount() : party.perOrder().lastMileAmount());
    }

    private static BigDecimal completedRate(TownClient.DeliveryPayoutConfig.Party party) {
        if (party == null || party.perOrder() == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return money(party.perOrder().completedOrderAmount());
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
}

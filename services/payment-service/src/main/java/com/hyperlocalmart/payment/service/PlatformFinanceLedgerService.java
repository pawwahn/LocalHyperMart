package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.response.PlatformFinanceLedgerResponse;
import com.hyperlocalmart.payment.entity.BuyerMembershipPurchase;
import com.hyperlocalmart.payment.entity.CodHubPlatformRemittance;
import com.hyperlocalmart.payment.entity.MembershipPurchaseStatus;
import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import com.hyperlocalmart.payment.entity.Refund;
import com.hyperlocalmart.payment.entity.RefundStatus;
import com.hyperlocalmart.payment.entity.Settlement;
import com.hyperlocalmart.payment.entity.SettlementDirection;
import com.hyperlocalmart.payment.entity.SettlementLineItem;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.WalletAccount;
import com.hyperlocalmart.payment.entity.WalletTransaction;
import com.hyperlocalmart.payment.repository.BuyerMembershipPurchaseRepository;
import com.hyperlocalmart.payment.repository.CodHubPlatformRemittanceRepository;
import com.hyperlocalmart.payment.repository.PaymentRepository;
import com.hyperlocalmart.payment.repository.RefundRepository;
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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformFinanceLedgerService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_RANGE_DAYS = 366;
    private static final int MAX_ENTRIES = 5000;

    private static final String COMPLIANCE_NOTE =
            "Cash book of platform bank/gateway movements for the period (IST). "
                    + "PASS_THROUGH rows are buyer collections or vendor/agent payouts for marketplace goods/services; "
                    + "OPERATING rows are KoyaKart revenue (membership, franchise) or refunds. "
                    + "WALLET rows (scratch, referral, store credit, checkout use) are every rupee of wallet "
                    + "liability — they are not bank/UTR movements. "
                    + "Reconcile bank lines with Razorpay settlement reports; reconcile wallet with Scratch and Referrals reports.";

    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final SettlementRepository settlementRepository;
    private final CodHubPlatformRemittanceRepository remittanceRepository;
    private final BuyerMembershipPurchaseRepository membershipPurchaseRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final WalletAccountRepository walletAccountRepository;
    private final PayeeDisplayNameService payeeDisplayNameService;

    @Transactional(readOnly = true)
    public PlatformFinanceLedgerResponse ledger(UUID townIdFilter, LocalDate from, LocalDate to) {
        validateRange(from, to);
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant endExclusive = to.plusDays(1).atStartOfDay(IST).toInstant();

        List<PlatformFinanceLedgerResponse.LedgerEntry> rows = new ArrayList<>();

        for (Payment payment : paymentRepository.findByStatusAndPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtAsc(
                PaymentStatus.SUCCESS, start, endExclusive)) {
            if (townIdFilter != null && !townIdFilter.equals(payment.getTownId())) {
                continue;
            }
            rows.add(fromOnlinePayment(payment));
        }

        for (BuyerMembershipPurchase purchase :
                membershipPurchaseRepository.findByPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtDesc(
                        start, endExclusive)) {
            if (purchase.getStatus() != MembershipPurchaseStatus.PAID || purchase.getPaidAt() == null) {
                continue;
            }
            if (townIdFilter != null && purchase.getTownId() != null && !townIdFilter.equals(purchase.getTownId())) {
                continue;
            }
            rows.add(fromMembership(purchase));
        }

        List<CodHubPlatformRemittance> remittances = townIdFilter == null
                ? remittanceRepository.findByRemittanceDateBetweenOrderByRemittanceDateAscCreatedAtAsc(from, to)
                : remittanceRepository.findByTownIdAndRemittanceDateBetweenOrderByRemittanceDateAscCreatedAtAsc(
                        townIdFilter, from, to);
        for (CodHubPlatformRemittance remittance : remittances) {
            rows.add(fromCodRemittance(remittance));
        }

        for (Settlement settlement : settlementRepository.findPaidWithLinesBetween(townIdFilter, start, endExclusive)) {
            rows.add(fromSettlement(settlement));
        }

        for (Refund refund : refundRepository.findByStatusAndRefundedAtGreaterThanEqualAndRefundedAtLessThanOrderByRefundedAtAsc(
                RefundStatus.REFUNDED, start, endExclusive)) {
            rows.add(fromRefund(refund));
        }

        rows.addAll(walletEntries(townIdFilter, start, endExclusive));

        rows.sort(Comparator.comparing(PlatformFinanceLedgerResponse.LedgerEntry::getOccurredAt).reversed());

        boolean truncated = rows.size() > MAX_ENTRIES;
        List<PlatformFinanceLedgerResponse.LedgerEntry> allRows = rows;
        if (truncated) {
            rows = new ArrayList<>(rows.subList(0, MAX_ENTRIES));
        }

        BigDecimal totalIn = BigDecimal.ZERO;
        BigDecimal totalOut = BigDecimal.ZERO;
        BigDecimal passIn = BigDecimal.ZERO;
        BigDecimal passOut = BigDecimal.ZERO;
        BigDecimal platformIn = BigDecimal.ZERO;
        BigDecimal operatingOut = BigDecimal.ZERO;
        BigDecimal walletGranted = BigDecimal.ZERO;
        BigDecimal walletRedeemed = BigDecimal.ZERO;
        BigDecimal walletScratch = BigDecimal.ZERO;
        BigDecimal walletReferral = BigDecimal.ZERO;
        BigDecimal walletStoreCredit = BigDecimal.ZERO;

        Map<String, PlatformFinanceLedgerResponse.CategoryTotal> categoryMap = new LinkedHashMap<>();
        Map<UUID, PlatformFinanceLedgerResponse.TownCashTotal> townMap = new LinkedHashMap<>();
        Map<UUID, PlatformFinanceLedgerResponse.PartyCashTotal> hubMap = new LinkedHashMap<>();
        Map<UUID, PlatformFinanceLedgerResponse.PartyCashTotal> vendorMap = new LinkedHashMap<>();

        Map<LocalDate, PlatformFinanceLedgerResponse.DailySummary> dailyMap = new LinkedHashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            dailyMap.put(d, PlatformFinanceLedgerResponse.DailySummary.builder()
                    .date(d)
                    .inflows(BigDecimal.ZERO)
                    .outflows(BigDecimal.ZERO)
                    .net(BigDecimal.ZERO)
                    .entries(0)
                    .build());
        }

        for (PlatformFinanceLedgerResponse.LedgerEntry row : allRows) {
            BigDecimal amt = money(row.getAmount());
            accumulateCategory(categoryMap, row, amt);
            boolean wallet = "WALLET".equals(row.getPaymentRail());
            if (townIdFilter == null && row.getTownId() != null && !wallet) {
                accumulateTown(townMap, row, amt);
            }
            if (!wallet) {
                accumulateParty(hubMap, row, amt, "HUB");
                accumulateParty(vendorMap, row, amt, "VENDOR");
            }
            if (wallet) {
                if ("OUT".equals(row.getDirection())) {
                    walletGranted = walletGranted.add(amt);
                    if ("WALLET_SCRATCH".equals(row.getCategory())) {
                        walletScratch = walletScratch.add(amt);
                    } else if ("WALLET_REFERRAL_REFEREE".equals(row.getCategory())
                            || "WALLET_REFERRAL_REFERRER".equals(row.getCategory())) {
                        walletReferral = walletReferral.add(amt);
                    } else if ("WALLET_STORE_CREDIT".equals(row.getCategory())) {
                        walletStoreCredit = walletStoreCredit.add(amt);
                    }
                } else {
                    walletRedeemed = walletRedeemed.add(amt);
                }
                continue;
            }
            if ("IN".equals(row.getDirection())) {
                totalIn = totalIn.add(amt);
                if ("PASS_THROUGH".equals(row.getCashNature())) {
                    passIn = passIn.add(amt);
                } else {
                    platformIn = platformIn.add(amt);
                }
            } else {
                totalOut = totalOut.add(amt);
                if ("PASS_THROUGH".equals(row.getCashNature())) {
                    passOut = passOut.add(amt);
                } else {
                    operatingOut = operatingOut.add(amt);
                }
            }
            PlatformFinanceLedgerResponse.DailySummary day = dailyMap.get(row.getBookDate());
            if (day != null) {
                if ("IN".equals(row.getDirection())) {
                    day.setInflows(day.getInflows().add(amt));
                } else {
                    day.setOutflows(day.getOutflows().add(amt));
                }
                day.setNet(day.getInflows().subtract(day.getOutflows()));
                day.setEntries(day.getEntries() + 1);
            }
        }

        List<PlatformFinanceLedgerResponse.CategoryTotal> categoryTotals = new ArrayList<>(categoryMap.values());
        categoryTotals.sort(Comparator
                .comparing(PlatformFinanceLedgerResponse.CategoryTotal::getDirection)
                .thenComparing(PlatformFinanceLedgerResponse.CategoryTotal::getCategoryLabel));

        List<PlatformFinanceLedgerResponse.TownCashTotal> townTotals = new ArrayList<>(townMap.values());
        townTotals.sort(Comparator.comparing(PlatformFinanceLedgerResponse.TownCashTotal::getInflows).reversed());

        List<PlatformFinanceLedgerResponse.PartyCashTotal> hubTotals = new ArrayList<>(hubMap.values());
        hubTotals.forEach(PlatformFinanceLedgerService::scaleParty);
        hubTotals.sort(Comparator
                .comparing(PlatformFinanceLedgerResponse.PartyCashTotal::getInflows, Comparator.reverseOrder())
                .thenComparing(PlatformFinanceLedgerResponse.PartyCashTotal::getOutflows, Comparator.reverseOrder()));

        List<PlatformFinanceLedgerResponse.PartyCashTotal> vendorTotals = new ArrayList<>(vendorMap.values());
        vendorTotals.forEach(PlatformFinanceLedgerService::scaleParty);
        vendorTotals.sort(Comparator
                .comparing(PlatformFinanceLedgerResponse.PartyCashTotal::getOutflows, Comparator.reverseOrder())
                .thenComparing(PlatformFinanceLedgerResponse.PartyCashTotal::getInflows, Comparator.reverseOrder()));

        return PlatformFinanceLedgerResponse.builder()
                .from(from)
                .to(to)
                .townId(townIdFilter)
                .totalInflows(scale(totalIn))
                .totalOutflows(scale(totalOut))
                .netCashMovement(scale(totalIn.subtract(totalOut)))
                .passThroughInflows(scale(passIn))
                .passThroughOutflows(scale(passOut))
                .platformReceipts(scale(platformIn))
                .operatingOutflows(scale(operatingOut))
                .walletGranted(scale(walletGranted))
                .walletRedeemed(scale(walletRedeemed))
                .walletScratch(scale(walletScratch))
                .walletReferral(scale(walletReferral))
                .walletStoreCredit(scale(walletStoreCredit))
                .entryCount(allRows.size())
                .truncated(truncated)
                .complianceNote(COMPLIANCE_NOTE)
                .daily(new ArrayList<>(dailyMap.values()))
                .categoryTotals(categoryTotals)
                .townCashTotals(townTotals)
                .hubCashTotals(hubTotals)
                .vendorCashTotals(vendorTotals)
                .entries(rows)
                .build();
    }

    private static void accumulateCategory(
            Map<String, PlatformFinanceLedgerResponse.CategoryTotal> map,
            PlatformFinanceLedgerResponse.LedgerEntry row,
            BigDecimal amt) {
        String key = row.getCategory() + "|" + row.getDirection() + "|" + row.getCashNature();
        PlatformFinanceLedgerResponse.CategoryTotal existing = map.get(key);
        if (existing == null) {
            map.put(
                    key,
                    PlatformFinanceLedgerResponse.CategoryTotal.builder()
                            .category(row.getCategory())
                            .categoryLabel(row.getCategoryLabel())
                            .direction(row.getDirection())
                            .cashNature(row.getCashNature())
                            .entryCount(1)
                            .amount(amt)
                            .build());
            return;
        }
        existing.setEntryCount(existing.getEntryCount() + 1);
        existing.setAmount(existing.getAmount().add(amt));
    }

    private static void accumulateTown(
            Map<UUID, PlatformFinanceLedgerResponse.TownCashTotal> map,
            PlatformFinanceLedgerResponse.LedgerEntry row,
            BigDecimal amt) {
        UUID townId = row.getTownId();
        PlatformFinanceLedgerResponse.TownCashTotal t = map.computeIfAbsent(
                townId,
                id -> PlatformFinanceLedgerResponse.TownCashTotal.builder()
                        .townId(id)
                        .inflows(BigDecimal.ZERO)
                        .outflows(BigDecimal.ZERO)
                        .platformReceipts(BigDecimal.ZERO)
                        .passThroughInflows(BigDecimal.ZERO)
                        .passThroughOutflows(BigDecimal.ZERO)
                        .build());
        if ("IN".equals(row.getDirection())) {
            t.setInflows(t.getInflows().add(amt));
            if ("PASS_THROUGH".equals(row.getCashNature())) {
                t.setPassThroughInflows(t.getPassThroughInflows().add(amt));
            } else {
                t.setPlatformReceipts(t.getPlatformReceipts().add(amt));
            }
        } else {
            t.setOutflows(t.getOutflows().add(amt));
            if ("PASS_THROUGH".equals(row.getCashNature())) {
                t.setPassThroughOutflows(t.getPassThroughOutflows().add(amt));
            }
        }
    }

    private static void accumulateParty(
            Map<UUID, PlatformFinanceLedgerResponse.PartyCashTotal> map,
            PlatformFinanceLedgerResponse.LedgerEntry row,
            BigDecimal amt,
            String expectedRole) {
        if (row.getCounterpartyId() == null || !expectedRole.equals(row.getCounterpartyRole())) {
            return;
        }
        PlatformFinanceLedgerResponse.PartyCashTotal t = map.computeIfAbsent(
                row.getCounterpartyId(),
                id -> PlatformFinanceLedgerResponse.PartyCashTotal.builder()
                        .partyId(id)
                        .partyName(row.getCounterpartyName())
                        .inflows(BigDecimal.ZERO)
                        .outflows(BigDecimal.ZERO)
                        .franchiseFees(BigDecimal.ZERO)
                        .codRemittances(BigDecimal.ZERO)
                        .otherInflows(BigDecimal.ZERO)
                        .payouts(BigDecimal.ZERO)
                        .txnCount(0)
                        .build());
        if ((t.getPartyName() == null || t.getPartyName().isBlank()) && row.getCounterpartyName() != null) {
            t.setPartyName(row.getCounterpartyName());
        }
        t.setTxnCount(t.getTxnCount() + 1);
        if ("IN".equals(row.getDirection())) {
            t.setInflows(t.getInflows().add(amt));
            String category = row.getCategory();
            if ("HUB_FRANCHISE_FEE".equals(category)) {
                t.setFranchiseFees(t.getFranchiseFees().add(amt));
            } else if ("HUB_COD_REMITTANCE".equals(category)) {
                t.setCodRemittances(t.getCodRemittances().add(amt));
            } else {
                t.setOtherInflows(t.getOtherInflows().add(amt));
            }
        } else {
            t.setOutflows(t.getOutflows().add(amt));
            t.setPayouts(t.getPayouts().add(amt));
        }
    }

    private static void scaleParty(PlatformFinanceLedgerResponse.PartyCashTotal t) {
        t.setInflows(scale(t.getInflows()));
        t.setOutflows(scale(t.getOutflows()));
        t.setFranchiseFees(scale(t.getFranchiseFees()));
        t.setCodRemittances(scale(t.getCodRemittances()));
        t.setOtherInflows(scale(t.getOtherInflows()));
        t.setPayouts(scale(t.getPayouts()));
    }

    private List<PlatformFinanceLedgerResponse.LedgerEntry> walletEntries(
            UUID townIdFilter, Instant start, Instant endExclusive) {
        List<WalletTransaction> txns =
                walletTransactionRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        start, endExclusive);
        if (txns.isEmpty()) {
            return List.of();
        }
        Set<UUID> walletIds = txns.stream().map(WalletTransaction::getWalletId).collect(Collectors.toSet());
        Map<UUID, UUID> walletUser = new HashMap<>();
        for (WalletAccount account : walletAccountRepository.findAllById(walletIds)) {
            walletUser.put(account.getId(), account.getUserId());
        }
        Set<UUID> orderIds = txns.stream()
                .map(WalletTransaction::getOrderId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, UUID> orderTown = new HashMap<>();
        if (!orderIds.isEmpty()) {
            for (Payment payment : paymentRepository.findByOrderIdIn(orderIds)) {
                if (payment.getTownId() != null) {
                    orderTown.putIfAbsent(payment.getOrderId(), payment.getTownId());
                }
            }
        }
        List<PlatformFinanceLedgerResponse.LedgerEntry> out = new ArrayList<>();
        for (WalletTransaction tx : txns) {
            UUID townId = tx.getOrderId() == null ? null : orderTown.get(tx.getOrderId());
            if (townIdFilter != null && (townId == null || !townIdFilter.equals(townId))) {
                continue;
            }
            out.add(fromWallet(tx, walletUser.get(tx.getWalletId()), townId));
        }
        return out;
    }

    private PlatformFinanceLedgerResponse.LedgerEntry fromWallet(
            WalletTransaction tx, UUID userId, UUID townId) {
        Instant at = tx.getCreatedAt() != null ? tx.getCreatedAt() : Instant.now();
        boolean credit = "CREDIT".equalsIgnoreCase(tx.getType());
        String ref = tx.getReferenceType() == null ? "" : tx.getReferenceType();
        String category;
        String label;
        String narrative;
        if (credit && "SCRATCH_CARD".equals(ref)) {
            category = "WALLET_SCRATCH";
            label = "Scratch card gift";
            narrative = "Wallet credit after buyer scratched a card — marketing burn, not a bank payout.";
        } else if (credit && "REFERRAL_REFEREE".equals(ref)) {
            category = "WALLET_REFERRAL_REFEREE";
            label = "Referral welcome credit";
            narrative = "Wallet credit to the friend who used a referral code.";
        } else if (credit && "REFERRAL_REFERRER".equals(ref)) {
            category = "WALLET_REFERRAL_REFERRER";
            label = "Referral referrer reward";
            narrative = "Wallet credit to the candidate after the friend's first delivery.";
        } else if (credit && ("ORDER_ITEM_CANCEL".equals(ref) || ref.contains("CANCEL"))) {
            category = "WALLET_STORE_CREDIT";
            label = "Store credit (item cancel)";
            narrative = "Wallet credit instead of a gateway refund when a shop cancelled an item.";
        } else if (!credit && "ORDER_CHECKOUT".equals(ref)) {
            category = "WALLET_REDEEMED";
            label = "Wallet used on order";
            narrative = "Buyer spent wallet at checkout — liability released; order cash collected is lower by this amount.";
        } else if (!credit && "ORDER_ITEM_RESTORE".equals(ref)) {
            category = "WALLET_RESTORED";
            label = "Store credit reversed";
            narrative = "Wallet debit when a cancelled item was restored.";
        } else if (credit) {
            category = "WALLET_OTHER_CREDIT";
            label = "Other wallet credit";
            narrative = firstNonBlank(tx.getNote(), "Wallet credit " + ref);
        } else {
            category = "WALLET_OTHER_DEBIT";
            label = "Other wallet debit";
            narrative = firstNonBlank(tx.getNote(), "Wallet debit " + ref);
        }
        return PlatformFinanceLedgerResponse.LedgerEntry.builder()
                .entryId(tx.getId())
                .sourceType("WALLET")
                .bookDate(at.atZone(IST).toLocalDate())
                .occurredAt(at)
                .direction(credit ? "OUT" : "IN")
                .category(category)
                .categoryLabel(label)
                .cashNature("OPERATING")
                .amount(money(tx.getAmount()))
                .currency("INR")
                .counterpartyRole("BUYER")
                .counterpartyName("Buyer wallet")
                .counterpartyId(userId)
                .townId(townId)
                .paymentRail("WALLET")
                .transactionReference(ref + (tx.getReferenceId() == null ? "" : " " + tx.getReferenceId()))
                .narrative(narrative)
                .orderId(tx.getOrderId())
                .build();
    }

    private PlatformFinanceLedgerResponse.LedgerEntry fromOnlinePayment(Payment payment) {
        Instant at = payment.getPaidAt() != null ? payment.getPaidAt() : payment.getCreatedAt();
        return PlatformFinanceLedgerResponse.LedgerEntry.builder()
                .entryId(payment.getId())
                .sourceType("ORDER_PAYMENT")
                .bookDate(at.atZone(IST).toLocalDate())
                .occurredAt(at)
                .direction("IN")
                .category("ONLINE_ORDER_COLLECTION")
                .categoryLabel("Online order collection (buyer)")
                .cashNature("PASS_THROUGH")
                .amount(money(payment.getAmount()))
                .currency(payment.getCurrency())
                .counterpartyRole("BUYER")
                .counterpartyName("Buyer")
                .counterpartyId(payment.getBuyerId())
                .townId(payment.getTownId())
                .paymentRail(payment.getGateway().name() + " / " + payment.getMethod())
                .transactionReference(firstNonBlank(payment.getGatewayPaymentId(), payment.getGatewayOrderId()))
                .narrative("Buyer paid online for marketplace order; vendor share settled separately as payout.")
                .orderId(payment.getOrderId())
                .build();
    }

    private PlatformFinanceLedgerResponse.LedgerEntry fromMembership(BuyerMembershipPurchase purchase) {
        Instant at = purchase.getPaidAt();
        return PlatformFinanceLedgerResponse.LedgerEntry.builder()
                .entryId(purchase.getId())
                .sourceType("MEMBERSHIP")
                .bookDate(at.atZone(IST).toLocalDate())
                .occurredAt(at)
                .direction("IN")
                .category("MEMBERSHIP_FEE")
                .categoryLabel("Buyer membership fee")
                .cashNature("OPERATING")
                .amount(money(purchase.getPriceSnapshot()))
                .currency("INR")
                .counterpartyRole("BUYER")
                .counterpartyName(maskPhone(purchase.getBuyerPhoneSnapshot()))
                .counterpartyId(purchase.getBuyerId())
                .townId(purchase.getTownId())
                .paymentRail(purchase.getPaymentChannel() != null ? purchase.getPaymentChannel().name() : "UNKNOWN")
                .transactionReference(purchase.getId().toString())
                .narrative("Membership plan " + purchase.getSlab() + " (" + purchase.getDurationMonths() + " mo) — platform revenue.")
                .build();
    }

    private PlatformFinanceLedgerResponse.LedgerEntry fromCodRemittance(CodHubPlatformRemittance remittance) {
        Instant at = remittance.getCreatedAt() != null ? remittance.getCreatedAt() : remittance.getRemittanceDate().atStartOfDay(IST).toInstant();
        return PlatformFinanceLedgerResponse.LedgerEntry.builder()
                .entryId(remittance.getId())
                .sourceType("COD_HUB_REMITTANCE")
                .bookDate(remittance.getRemittanceDate())
                .occurredAt(at)
                .direction("IN")
                .category("HUB_COD_REMITTANCE")
                .categoryLabel("Hub COD remittance to company")
                .cashNature("PASS_THROUGH")
                .amount(money(remittance.getAmount()))
                .currency("INR")
                .counterpartyRole("HUB")
                .counterpartyName(payeeDisplayNameService.forHub(remittance.getHubId()))
                .counterpartyId(remittance.getHubId())
                .townId(remittance.getTownId())
                .paymentRail("BANK")
                .transactionReference(firstNonBlank(remittance.getReference(), remittance.getId().toString()))
                .narrative("Hub remitted COD cash collected from buyers on delivery (verified bank transfer).")
                .build();
    }

    private PlatformFinanceLedgerResponse.LedgerEntry fromSettlement(Settlement settlement) {
        Instant at = settlement.getPaidAt() != null ? settlement.getPaidAt() : settlement.getCreatedAt();
        boolean collection = settlement.getDirection() == SettlementDirection.COLLECTION;
        boolean franchise = settlement.getLineItems() != null && settlement.getLineItems().stream()
                .anyMatch(l -> "FRANCHISE".equalsIgnoreCase(l.getLineType()));

        String direction = collection ? "IN" : "OUT";
        String category;
        String categoryLabel;
        String cashNature;
        String counterpartyRole;
        String narrative;

        if (collection && franchise) {
            category = "HUB_FRANCHISE_FEE";
            categoryLabel = "Hub franchise fee received";
            cashNature = "OPERATING";
            counterpartyRole = "HUB";
            narrative = "Franchise fee received from hub for the operating period.";
        } else if (collection && settlement.getPayeeType() == SettlementPayeeType.VENDOR) {
            category = "VENDOR_FEE_COLLECTION";
            categoryLabel = "Vendor fees received";
            cashNature = "OPERATING";
            counterpartyRole = "VENDOR";
            narrative = "Commission / monthly fee collected from vendor (shop already held COD, or monthly due).";
        } else if (collection) {
            category = "HUB_COLLECTION";
            categoryLabel = "Collection from hub";
            cashNature = "OPERATING";
            counterpartyRole = "HUB";
            narrative = "Amount collected from hub (non-vendor pass-through).";
        } else if (settlement.getPayeeType() == SettlementPayeeType.VENDOR) {
            category = "VENDOR_PAYOUT";
            categoryLabel = "Vendor goods payout";
            cashNature = "PASS_THROUGH";
            counterpartyRole = "VENDOR";
            narrative = "Paid vendor for delivered goods (marketplace pass-through; not platform income).";
        } else if (settlement.getPayeeType() == SettlementPayeeType.AGENT) {
            category = "AGENT_DELIVERY_PAYOUT";
            categoryLabel = "Delivery agent payout";
            cashNature = "PASS_THROUGH";
            counterpartyRole = "DELIVERY_AGENT";
            narrative = "Paid delivery agent for completed trips/orders.";
        } else {
            category = "HUB_DELIVERY_PAYOUT";
            categoryLabel = "Hub delivery commission payout";
            cashNature = "PASS_THROUGH";
            counterpartyRole = "HUB";
            narrative = "Paid hub delivery commission for completed legs.";
        }

        String orderNums = orderNumbersFromLines(settlement.getLineItems());
        String period = settlement.getPeriodStart() + " → " + settlement.getPeriodEnd();

        return PlatformFinanceLedgerResponse.LedgerEntry.builder()
                .entryId(settlement.getId())
                .sourceType("SETTLEMENT")
                .bookDate(at.atZone(IST).toLocalDate())
                .occurredAt(at)
                .direction(direction)
                .category(category)
                .categoryLabel(categoryLabel)
                .cashNature(cashNature)
                .amount(money(settlement.getNetAmount()))
                .currency("INR")
                .counterpartyRole(counterpartyRole)
                .counterpartyName(payeeDisplayNameService.forSettlement(settlement))
                .counterpartyId(settlement.getPayeeId())
                .townId(settlement.getTownId())
                .paymentRail(settlement.getPayoutMethod())
                .transactionReference(settlement.getTransactionReference())
                .narrative(narrative)
                .orderNumbers(orderNums)
                .periodLabel(period)
                .settlementId(settlement.getId())
                .build();
    }

    private PlatformFinanceLedgerResponse.LedgerEntry fromRefund(Refund refund) {
        Instant at = refund.getRefundedAt() != null ? refund.getRefundedAt() : refund.getCreatedAt();
        return PlatformFinanceLedgerResponse.LedgerEntry.builder()
                .entryId(refund.getId())
                .sourceType("REFUND")
                .bookDate(at.atZone(IST).toLocalDate())
                .occurredAt(at)
                .direction("OUT")
                .category("BUYER_REFUND")
                .categoryLabel("Refund to buyer")
                .cashNature("OPERATING")
                .amount(money(refund.getAmount()))
                .currency("INR")
                .counterpartyRole("BUYER")
                .counterpartyName("Buyer")
                .townId(null)
                .paymentRail("GATEWAY")
                .transactionReference(firstNonBlank(refund.getGatewayRefundId(), refund.getId().toString()))
                .narrative("Refund to buyer for order — reduces collections.")
                .orderId(refund.getOrderId())
                .build();
    }

    private static String orderNumbersFromLines(List<SettlementLineItem> lines) {
        if (lines == null || lines.isEmpty()) {
            return null;
        }
        return lines.stream()
                .map(SettlementLineItem::getOrderNumber)
                .filter(Objects::nonNull)
                .filter(s -> !s.isBlank())
                .distinct()
                .limit(5)
                .collect(Collectors.joining(", "));
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) {
            return "Buyer";
        }
        return "Buyer " + phone.substring(phone.length() - 4);
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' and 'to' are required");
        }
        if (from.isAfter(to)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "'from' must be on or before 'to'");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
    }
}

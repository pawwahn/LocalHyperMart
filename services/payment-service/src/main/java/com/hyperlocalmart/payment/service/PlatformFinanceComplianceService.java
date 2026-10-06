package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.config.PaymentProperties;
import com.hyperlocalmart.payment.dto.request.CreateRazorpaySettlementBatchRequest;
import com.hyperlocalmart.payment.dto.response.PlatformFinanceComplianceResponse;
import com.hyperlocalmart.payment.dto.response.PlatformFinanceLedgerResponse;
import com.hyperlocalmart.payment.entity.BuyerMembershipPurchase;
import com.hyperlocalmart.payment.entity.MembershipPurchaseStatus;
import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import com.hyperlocalmart.payment.entity.RazorpaySettlementBatch;
import com.hyperlocalmart.payment.entity.Refund;
import com.hyperlocalmart.payment.entity.RefundStatus;
import com.hyperlocalmart.payment.entity.Settlement;
import com.hyperlocalmart.payment.entity.SettlementDirection;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.repository.BuyerMembershipPurchaseRepository;
import com.hyperlocalmart.payment.repository.PaymentRepository;
import com.hyperlocalmart.payment.repository.RefundRepository;
import com.hyperlocalmart.payment.repository.RazorpaySettlementBatchRepository;
import com.hyperlocalmart.payment.repository.SettlementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlatformFinanceComplianceService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String TDS_NOTE =
            "Estimated TDS on gross sales facilitated to vendors (typical e-commerce operator liability u/s 194O). "
                    + "Rate is configurable; deposit challans and deductee reporting are done outside this screen.";

    private final PlatformFinanceLedgerService platformFinanceLedgerService;
    private final OrderClient orderClient;
    private final PaymentProperties paymentProperties;
    private final SettlementRepository settlementRepository;
    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final BuyerMembershipPurchaseRepository membershipPurchaseRepository;
    private final RazorpaySettlementBatchRepository razorpaySettlementBatchRepository;
    private final PayeeDisplayNameService payeeDisplayNameService;

    @Transactional(readOnly = true)
    public PlatformFinanceComplianceResponse compliancePack(UUID townId, LocalDate from, LocalDate to) {
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant endExclusive = to.plusDays(1).atStartOfDay(IST).toInstant();

        PlatformFinanceLedgerResponse ledger = platformFinanceLedgerService.ledger(townId, from, to);
        OrderClient.FinanceAccrual accrual = orderClient.getFinanceAccrual(townId, from, to);

        BigDecimal vendorCommission = BigDecimal.ZERO;
        List<PlatformFinanceComplianceResponse.TdsLine> tdsLines = new ArrayList<>();
        BigDecimal tdsRate = paymentProperties.getVendorPayoutTdsRatePercent() == null
                ? BigDecimal.ZERO
                : paymentProperties.getVendorPayoutTdsRatePercent();
        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalNet = BigDecimal.ZERO;
        BigDecimal totalTds = BigDecimal.ZERO;

        for (Settlement s : settlementRepository.findPaidVendorSettlementsBetween(townId, start, endExclusive)) {
            BigDecimal gross = money(s.getGrossAmount());
            BigDecimal commission = money(s.getCommissionAmount());
            BigDecimal net = money(s.getNetAmount());
            vendorCommission = vendorCommission.add(commission);
            totalGross = totalGross.add(gross);
            totalNet = totalNet.add(net);
            BigDecimal tds = gross.multiply(tdsRate).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
            totalTds = totalTds.add(tds);
            Instant paidAt = s.getPaidAt();
            tdsLines.add(PlatformFinanceComplianceResponse.TdsLine.builder()
                    .settlementId(s.getId())
                    .paidDate(paidAt != null ? paidAt.atZone(IST).toLocalDate() : null)
                    .vendorName(payeeDisplayNameService.forSettlement(s))
                    .vendorId(s.getPayeeId())
                    .grossSales(gross)
                    .platformCommission(commission)
                    .netPaid(net)
                    .tdsEstimated(tds)
                    .transactionReference(s.getTransactionReference())
                    .build());
        }

        BigDecimal membershipRevenue = BigDecimal.ZERO;
        for (BuyerMembershipPurchase p :
                membershipPurchaseRepository.findByPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtDesc(
                        start, endExclusive)) {
            if (p.getStatus() != MembershipPurchaseStatus.PAID) {
                continue;
            }
            if (townId != null && p.getTownId() != null && !townId.equals(p.getTownId())) {
                continue;
            }
            membershipRevenue = membershipRevenue.add(money(p.getPriceSnapshot()));
        }

        BigDecimal platformRevenue = money(accrual.estimatedPlatformRevenueFromOrders())
                .add(vendorCommission)
                .add(membershipRevenue);

        List<PlatformFinanceComplianceResponse.DailyAccrual> dailyAccrual = accrual.daily().stream()
                .map(d -> PlatformFinanceComplianceResponse.DailyAccrual.builder()
                        .date(d.date())
                        .ordersDelivered(d.ordersDelivered())
                        .platformFees(money(d.platformFees()))
                        .deliveredGmv(money(d.deliveredGmv()))
                        .gstTotal(money(d.gstTotal()))
                        .build())
                .toList();

        PlatformFinanceComplianceResponse.GatewayReconciliation gateway =
                buildGatewayReconciliation(townId, from, to, start, endExclusive);

        PlatformFinanceComplianceResponse.PayoutRegister payoutRegister =
                buildPayoutRegister(townId, start, endExclusive);
        PlatformFinanceComplianceResponse.RefundRegister refundRegister =
                buildRefundRegister(townId, start, endExclusive);
        PlatformFinanceComplianceResponse.ManagementSummary management =
                buildManagementSummary(ledger, platformRevenue, gateway, refundRegister);

        return PlatformFinanceComplianceResponse.builder()
                .from(from)
                .to(to)
                .townId(townId)
                .cashLedger(ledger)
                .accrual(PlatformFinanceComplianceResponse.RevenueAccrual.builder()
                        .ordersDelivered(accrual.ordersDelivered())
                        .deliveredOrderValue(money(accrual.deliveredOrderValue()))
                        .platformFeesOnDelivered(money(accrual.platformFeesOnDelivered()))
                        .deliveryFeesOnDelivered(money(accrual.deliveryFeesOnDelivered()))
                        .codFeesOnDelivered(money(accrual.codFeesOnDelivered()))
                        .vendorCommissionEarned(vendorCommission)
                        .membershipRevenue(membershipRevenue)
                        .totalEstimatedPlatformRevenue(platformRevenue)
                        .daily(dailyAccrual)
                        .build())
                .gst(PlatformFinanceComplianceResponse.GstSummary.builder()
                        .cgstOnDeliveredItems(money(accrual.itemCgst()))
                        .sgstOnDeliveredItems(money(accrual.itemSgst()))
                        .igstOnDeliveredItems(money(accrual.itemIgst()))
                        .totalGstOnDeliveredItems(money(accrual.itemGstTotal()))
                        .orderLevelTaxAmount(money(accrual.orderLevelTaxAmount()))
                        .note("GST on delivered line items (CGST/SGST/IGST snapshots on order items). "
                                + "Validate against GSTR-1 / invoice register.")
                        .build())
                .tds(PlatformFinanceComplianceResponse.TdsReport.builder()
                        .ratePercent(tdsRate)
                        .legalNote(TDS_NOTE)
                        .totalGrossSalesFacilitated(totalGross)
                        .totalTdsEstimated(totalTds)
                        .totalNetPaidToVendors(totalNet)
                        .totalPlatformCommission(vendorCommission)
                        .lines(tdsLines)
                        .build())
                .gateway(gateway)
                .managementSummary(management)
                .payoutRegister(payoutRegister)
                .refundRegister(refundRegister)
                .build();
    }

    private PlatformFinanceComplianceResponse.ManagementSummary buildManagementSummary(
            PlatformFinanceLedgerResponse ledger,
            BigDecimal estimatedPlatformRevenue,
            PlatformFinanceComplianceResponse.GatewayReconciliation gateway,
            PlatformFinanceComplianceResponse.RefundRegister refunds) {
        BigDecimal buyerRefunds = refunds.getTotalRefunded();
        BigDecimal gatewayFees = money(gateway.getImportedSettlementFees());
        BigDecimal walletGranted = money(ledger.getWalletGranted());
        BigDecimal surplus = money(estimatedPlatformRevenue)
                .subtract(buyerRefunds)
                .subtract(gatewayFees)
                .subtract(walletGranted);
        BigDecimal passFloat = money(ledger.getPassThroughInflows()).subtract(money(ledger.getPassThroughOutflows()));
        String indicator;
        if (surplus.compareTo(BigDecimal.ZERO) > 0) {
            indicator = "SURPLUS";
        } else if (surplus.compareTo(BigDecimal.ZERO) < 0) {
            indicator = "SHORTFALL";
        } else {
            indicator = "BREAK_EVEN";
        }
        return PlatformFinanceComplianceResponse.ManagementSummary.builder()
                .estimatedPlatformRevenue(money(estimatedPlatformRevenue))
                .platformCashReceipts(money(ledger.getPlatformReceipts()))
                .buyerRefunds(buyerRefunds)
                .paymentGatewayFees(gatewayFees)
                .netSurplusBeforeOperatingExpenses(surplus)
                .passThroughFloat(passFloat)
                .netCashMovement(money(ledger.getNetCashMovement()))
                .walletGranted(walletGranted)
                .walletScratch(money(ledger.getWalletScratch()))
                .walletReferral(money(ledger.getWalletReferral()))
                .walletStoreCredit(money(ledger.getWalletStoreCredit()))
                .platformResultIndicator(indicator)
                .note("Management view: estimated platform revenue (accrual) minus buyer refunds, imported "
                        + "Razorpay fees, and wallet gifts (scratch, referral, store credit). "
                        + "Wallet gifts are not bank payouts — they sit as buyer wallet liability until used. "
                        + "Excludes salaries, rent, and other opex. Pass-through float is not profit.")
                .build();
    }

    private PlatformFinanceComplianceResponse.PayoutRegister buildPayoutRegister(
            UUID townId, Instant start, Instant endExclusive) {
        BigDecimal vendor = BigDecimal.ZERO;
        BigDecimal agent = BigDecimal.ZERO;
        BigDecimal hubDelivery = BigDecimal.ZERO;
        BigDecimal franchise = BigDecimal.ZERO;
        BigDecimal otherHubIn = BigDecimal.ZERO;
        BigDecimal vendorFees = BigDecimal.ZERO;
        List<PlatformFinanceComplianceResponse.PayoutLine> lines = new ArrayList<>();

        for (Settlement s : settlementRepository.findPaidWithLinesBetween(townId, start, endExclusive)) {
            boolean franchiseFee = s.getLineItems() != null && s.getLineItems().stream()
                    .anyMatch(l -> "FRANCHISE".equalsIgnoreCase(l.getLineType()));
            Instant paidAt = s.getPaidAt();
            LocalDate paidDate = paidAt != null ? paidAt.atZone(IST).toLocalDate() : null;
            String period = s.getPeriodStart() + " → " + s.getPeriodEnd();
            BigDecimal gross = money(s.getGrossAmount());
            BigDecimal commission = money(s.getCommissionAmount());
            BigDecimal net = money(s.getNetAmount());

            PlatformFinanceComplianceResponse.PayoutLine line =
                    PlatformFinanceComplianceResponse.PayoutLine.builder()
                            .settlementId(s.getId())
                            .paidDate(paidDate)
                            .payeeType(s.getPayeeType().name())
                            .direction(s.getDirection().name())
                            .payeeName(payeeDisplayNameService.forSettlement(s))
                            .payeeId(s.getPayeeId())
                            .townId(s.getTownId())
                            .grossAmount(gross)
                            .commissionAmount(commission)
                            .netAmount(net)
                            .periodLabel(period)
                            .transactionReference(s.getTransactionReference())
                            .franchiseFee(franchiseFee)
                            .build();
            lines.add(line);

            if (s.getDirection() == SettlementDirection.COLLECTION) {
                if (franchiseFee) {
                    franchise = franchise.add(net);
                } else if (s.getPayeeType() == SettlementPayeeType.VENDOR) {
                    vendorFees = vendorFees.add(net);
                } else {
                    otherHubIn = otherHubIn.add(net);
                }
                continue;
            }
            if (s.getPayeeType() == SettlementPayeeType.VENDOR) {
                vendor = vendor.add(net);
            } else if (s.getPayeeType() == SettlementPayeeType.AGENT) {
                agent = agent.add(net);
            } else {
                hubDelivery = hubDelivery.add(net);
            }
        }

        return PlatformFinanceComplianceResponse.PayoutRegister.builder()
                .vendorPayouts(vendor)
                .agentPayouts(agent)
                .hubDeliveryPayouts(hubDelivery)
                .franchiseFeesCollected(franchise)
                .otherCollectionsFromHubs(otherHubIn)
                .vendorFeesCollected(vendorFees)
                .lines(lines)
                .build();
    }

    private PlatformFinanceComplianceResponse.RefundRegister buildRefundRegister(
            UUID townId, Instant start, Instant endExclusive) {
        List<PlatformFinanceComplianceResponse.RefundLine> lines = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Refund r : refundRepository.findByStatusAndRefundedAtGreaterThanEqualAndRefundedAtLessThanOrderByRefundedAtAsc(
                RefundStatus.REFUNDED, start, endExclusive)) {
            UUID refundTown = null;
            Payment payment = paymentRepository.findById(r.getPaymentId()).orElse(null);
            if (payment != null) {
                refundTown = payment.getTownId();
            }
            if (townId != null && refundTown != null && !townId.equals(refundTown)) {
                continue;
            }
            if (townId != null && refundTown == null) {
                continue;
            }
            BigDecimal amt = money(r.getAmount());
            total = total.add(amt);
            Instant at = r.getRefundedAt() != null ? r.getRefundedAt() : r.getCreatedAt();
            lines.add(PlatformFinanceComplianceResponse.RefundLine.builder()
                    .refundId(r.getId())
                    .refundDate(at.atZone(IST).toLocalDate())
                    .orderId(r.getOrderId())
                    .paymentId(r.getPaymentId())
                    .townId(refundTown)
                    .amount(amt)
                    .reason(r.getReason())
                    .gatewayReference(r.getGatewayRefundId())
                    .build());
        }
        return PlatformFinanceComplianceResponse.RefundRegister.builder()
                .refundCount(lines.size())
                .totalRefunded(total)
                .lines(lines)
                .build();
    }

    @Transactional
    public PlatformFinanceComplianceResponse.RazorpayBatchRow recordRazorpayBatch(
            UUID adminUserId, CreateRazorpaySettlementBatchRequest request) {
        if (razorpaySettlementBatchRepository.existsByUtrReference(request.getUtrReference().trim())) {
            throw new BusinessException(ErrorCode.CONFLICT, "UTR / settlement id already recorded");
        }
        RazorpaySettlementBatch row = RazorpaySettlementBatch.builder()
                .settlementDate(request.getSettlementDate())
                .utrReference(request.getUtrReference().trim())
                .grossAmount(money(request.getGrossAmount()))
                .feeAmount(money(request.getFeeAmount()))
                .netAmount(money(request.getNetAmount()))
                .paymentCount(request.getPaymentCount())
                .notes(request.getNotes())
                .build();
        row.setCreatedBy(adminUserId);
        row.setUpdatedBy(adminUserId);
        row = razorpaySettlementBatchRepository.save(row);
        return toBatchRow(row);
    }

    private PlatformFinanceComplianceResponse.GatewayReconciliation buildGatewayReconciliation(
            UUID townId,
            LocalDate from,
            LocalDate to,
            Instant start,
            Instant endExclusive) {
        BigDecimal onlineIn = BigDecimal.ZERO;
        Map<LocalDate, BigDecimal> appByDay = new HashMap<>();
        for (Payment p : paymentRepository.findByStatusAndPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtAsc(
                PaymentStatus.SUCCESS, start, endExclusive)) {
            if (townId != null && !townId.equals(p.getTownId())) {
                continue;
            }
            BigDecimal amt = money(p.getAmount());
            onlineIn = onlineIn.add(amt);
            LocalDate day = p.getPaidAt().atZone(IST).toLocalDate();
            appByDay.merge(day, amt, BigDecimal::add);
        }

        BigDecimal refunds = BigDecimal.ZERO;
        for (Refund r : refundRepository.findByStatusAndRefundedAtGreaterThanEqualAndRefundedAtLessThanOrderByRefundedAtAsc(
                RefundStatus.REFUNDED, start, endExclusive)) {
            refunds = refunds.add(money(r.getAmount()));
        }

        BigDecimal grossBatch = BigDecimal.ZERO;
        BigDecimal feeBatch = BigDecimal.ZERO;
        BigDecimal netBatch = BigDecimal.ZERO;
        Map<LocalDate, BigDecimal> bankByDay = new HashMap<>();
        List<PlatformFinanceComplianceResponse.RazorpayBatchRow> batches = new ArrayList<>();
        for (RazorpaySettlementBatch b :
                razorpaySettlementBatchRepository.findBySettlementDateBetweenOrderBySettlementDateAscCreatedAtAsc(
                        from, to)) {
            grossBatch = grossBatch.add(money(b.getGrossAmount()));
            feeBatch = feeBatch.add(money(b.getFeeAmount()));
            netBatch = netBatch.add(money(b.getNetAmount()));
            bankByDay.merge(b.getSettlementDate(), money(b.getNetAmount()), BigDecimal::add);
            batches.add(toBatchRow(b));
        }

        BigDecimal appNet = onlineIn.subtract(refunds);
        List<PlatformFinanceComplianceResponse.GatewayDayRow> byDay = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            BigDecimal app = appByDay.getOrDefault(d, BigDecimal.ZERO);
            BigDecimal bank = bankByDay.getOrDefault(d, BigDecimal.ZERO);
            byDay.add(PlatformFinanceComplianceResponse.GatewayDayRow.builder()
                    .date(d)
                    .appCollected(app)
                    .bankSettledNet(bank)
                    .variance(app.subtract(bank))
                    .build());
        }

        return PlatformFinanceComplianceResponse.GatewayReconciliation.builder()
                .appOnlineCollections(onlineIn)
                .appOnlineRefunds(refunds)
                .appNetOnline(appNet)
                .importedSettlementGross(grossBatch)
                .importedSettlementFees(feeBatch)
                .importedSettlementNet(netBatch)
                .varianceAppNetVsBankNet(appNet.subtract(netBatch))
                .note("Import Razorpay settlement rows (UTR from dashboard) to match bank credits. "
                        + "App collections are payment SUCCESS timestamps; bank dates lag by T+1/T+2.")
                .byDay(byDay)
                .batches(batches)
                .build();
    }

    private static PlatformFinanceComplianceResponse.RazorpayBatchRow toBatchRow(RazorpaySettlementBatch b) {
        return PlatformFinanceComplianceResponse.RazorpayBatchRow.builder()
                .id(b.getId())
                .settlementDate(b.getSettlementDate())
                .utrReference(b.getUtrReference())
                .grossAmount(b.getGrossAmount())
                .feeAmount(b.getFeeAmount())
                .netAmount(b.getNetAmount())
                .paymentCount(b.getPaymentCount())
                .notes(b.getNotes())
                .build();
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}

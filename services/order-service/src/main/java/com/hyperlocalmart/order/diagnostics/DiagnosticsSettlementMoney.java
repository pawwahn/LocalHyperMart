package com.hyperlocalmart.order.diagnostics;

import com.hyperlocalmart.order.entity.DiagnosticsOrder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

/**
 * Diagnostics settlement money — grocery-like vendor economics without hub/agent delivery pay.
 * <ul>
 *   <li>Commission base = tests + home collection (lab GMV).</li>
 *   <li>Platform fee and COD surcharge always belong to KoyaKart.</li>
 *   <li>UPI: buyer paid KoyaKart → Pay lab once samples are at the lab (GMV − commission); report TAT is separate.</li>
 *   <li>COD: lab holds buyer cash → Send bill (commission + platform + COD surcharge) after samples at lab.</li>
 * </ul>
 */
public final class DiagnosticsSettlementMoney {

    private static final Set<DiagnosticsOrderStatus> PAYOUT_STATUSES = EnumSet.of(
            DiagnosticsOrderStatus.RECEIVED_AT_LAB,
            DiagnosticsOrderStatus.REPORT_ETA_SET,
            DiagnosticsOrderStatus.REPORT_IN_PROGRESS,
            DiagnosticsOrderStatus.REPORT_FINALIZED,
            DiagnosticsOrderStatus.COMPLETED);

    private DiagnosticsSettlementMoney() {
    }

    /** Samples at lab — report may still take days. */
    public static boolean billable(DiagnosticsOrderStatus status) {
        return status != null && PAYOUT_STATUSES.contains(status);
    }

    public static boolean settlementEligible(DiagnosticsOrder order) {
        if (order == null || !billable(order.getStatus())) {
            return false;
        }
        DiagnosticsPaymentStatus pay = order.getPaymentStatus();
        if (online(order)) {
            return pay == DiagnosticsPaymentStatus.PAID || pay == DiagnosticsPaymentStatus.COLLECTED;
        }
        return pay == DiagnosticsPaymentStatus.COLLECTED || pay == DiagnosticsPaymentStatus.PAID;
    }

    public static BigDecimal goodsSubtotal(DiagnosticsOrder order) {
        return money(order.getTestsSubtotal()).add(money(order.getHomeCollectionFee()));
    }

    public static boolean online(DiagnosticsOrder order) {
        return order.getPaymentMethod() == DiagnosticsPaymentMethod.UPI;
    }

    /** When the lab took custody of samples — settlement date range uses this, not report finalize. */
    public static Instant settlementInstant(DiagnosticsOrder order) {
        if (order.getSamplesReceivedAtLabAt() != null) {
            return order.getSamplesReceivedAtLabAt();
        }
        if (order.getReportFinalizedAt() != null) {
            return order.getReportFinalizedAt();
        }
        if (order.getUpdatedAt() != null) {
            return order.getUpdatedAt();
        }
        return order.getPlacedAt();
    }

    /** Platform fee on vendor sales / payout UI (matches buyer receipt). */
    public static BigDecimal buyerPlatformFeeForVendorReport(DiagnosticsOrder order) {
        return money(order.getPlatformFeeAmount());
    }

    /**
     * Buyer platform fee billed back when the lab holds COD cash; zero on UPI (already retained at checkout).
     */
    public static BigDecimal buyerPlatformFeeForSettlement(DiagnosticsOrder order) {
        if (online(order)) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return money(order.getPlatformFeeAmount());
    }

    public static BigDecimal buyerCodFeeForSettlement(DiagnosticsOrder order) {
        if (online(order)) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return money(order.getCodFee());
    }

    static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}

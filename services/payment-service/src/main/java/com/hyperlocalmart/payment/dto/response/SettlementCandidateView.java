package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class SettlementCandidateView {
    UUID vendorId;
    UUID townId;
    String from;
    String to;
    /** Pending claim chargebacks that will auto-deduct on the next payout for this vendor+town. */
    BigDecimal pendingClaimChargebacks;
    int pendingClaimCount;
    List<PendingClaim> pendingClaims;
    List<Item> items;

    @Value
    @Builder
    public static class PendingClaim {
        UUID claimId;
        String orderNumber;
        BigDecimal amount;
        String reason;
    }

    @Value
    @Builder
    public static class Item {
        UUID subOrderId;
        UUID orderId;
        String orderNumber;
        String subOrderNumber;
        Instant placedAt;
        String status;
        String paymentStatus;
        /** COD or ONLINE — buyer payment rail for the parent order. */
        String paymentMethod;
        /** Shop-agent delivery (COD custodian is vendor, not hub close-day). */
        boolean vendorAgentDelivery;
        /**
         * For COD delivered orders: true after hub records agent remittance (COD close-day).
         * False = cash still treated as with the delivery agent until close-day.
         * Ignored for {@code vendorAgentDelivery} — use {@link #codCashLocation} instead.
         */
        Boolean codRemittedToHub;
        /**
         * WITH_AGENT | AT_HUB | WITH_VENDOR | DECLARED_TO_VENDOR — null for non-COD.
         */
        String codCashLocation;
        /** LAST_MILE / shop agent who delivered — when {@code codCashLocation} is WITH_AGENT. */
        UUID codDeliveringAgentId;
        String codDeliveringAgentName;
        /** Agent mobile for support / settlement follow-up. */
        String codDeliveringAgentPhone;
        BigDecimal subtotal;
        boolean alreadySettled;
    }
}

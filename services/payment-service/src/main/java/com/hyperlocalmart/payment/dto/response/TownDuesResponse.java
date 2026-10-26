package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class TownDuesResponse {
    LocalDate from;
    LocalDate to;
    BigDecimal sendBill;
    BigDecimal collect;
    BigDecimal pay;
    BigDecimal confirm;
    int townCount;

    @Builder.Default
    List<Town> towns = new ArrayList<>();

    @Value
    @Builder
    public static class Town {
        UUID townId;
        BigDecimal sendBill;
        BigDecimal collect;
        BigDecimal pay;
        BigDecimal confirm;

        @Builder.Default
        List<Line> lines = new ArrayList<>();
    }

    @Value
    @Builder
    public static class Line {
        /** HUB, VENDOR, or AGENT. */
        String party;
        UUID partyId;
        String partyName;
        /** SEND_BILL, COLLECT, PAY, or CONFIRM. */
        String action;
        String what;
        /** Goods, fee, cash holder, and order numbers behind {@link #amount}. */
        String detail;
        LocalDate periodStart;
        LocalDate periodEnd;
        BigDecimal amount;
        /**
         * Vendor commission on this row. Shop-held bills collect it. Payout rows have already
         * taken it off {@link #amount}. Null when the row is not vendor commission (subscription,
         * hub cash, franchise, delivery fees).
         */
        BigDecimal commission;
        /** Buyer platform fee on shop-held COD rows. */
        BigDecimal platformFee;
        /** Buyer COD surcharge on shop-held rows. */
        BigDecimal codFee;
        /** Bundled buyer delivery / membership plan on shop-held COD. */
        BigDecimal membershipFee;
        /** Penalties or other charges on vendor collection bills. */
        BigDecimal penalty;
        int itemCount;
        String reference;
        /** Settlement to confirm. Set when {@link #action} is CONFIRM for a vendor or hub settlement bill. */
        UUID settlementId;
        /** Hub payment submission to verify. Set when {@link #action} is CONFIRM for a hub bill. */
        UUID submissionId;
        String paymentMethod;
        String paymentReference;
    }
}

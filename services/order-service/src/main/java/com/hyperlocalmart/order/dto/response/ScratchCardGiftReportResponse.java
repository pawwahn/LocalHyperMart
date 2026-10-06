package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class ScratchCardGiftReportResponse {

    private LocalDate from;
    private LocalDate to;
    private long issued;
    private long scratched;
    private long unopened;
    @Builder.Default
    private BigDecimal giftedAmount = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal avgGift = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal minGift = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal maxGift = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal pendingMin = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal pendingMax = BigDecimal.ZERO;
    @Builder.Default
    private List<TownRow> towns = new ArrayList<>();
    @Builder.Default
    private List<Line> lines = new ArrayList<>();

    @Data
    @Builder
    public static class TownRow {
        private UUID townId;
        private String townName;
        private long issued;
        private long scratched;
        private long unopened;
        @Builder.Default
        private BigDecimal giftedAmount = BigDecimal.ZERO;
    }

    @Data
    @Builder
    public static class Line {
        private UUID cardId;
        private String issuedAt;
        private String revealedAt;
        private String status;
        private UUID townId;
        private String townName;
        private UUID orderId;
        private String orderNumber;
        private String buyerPhone;
        @Builder.Default
        private BigDecimal revealedAmount = BigDecimal.ZERO;
        @Builder.Default
        private BigDecimal rewardMin = BigDecimal.ZERO;
        @Builder.Default
        private BigDecimal rewardMax = BigDecimal.ZERO;
        @Builder.Default
        private BigDecimal companySpent = BigDecimal.ZERO;
    }
}

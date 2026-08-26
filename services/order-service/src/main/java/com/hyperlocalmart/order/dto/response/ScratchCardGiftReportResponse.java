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
    private List<TownRow> towns = new ArrayList<>();

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
}

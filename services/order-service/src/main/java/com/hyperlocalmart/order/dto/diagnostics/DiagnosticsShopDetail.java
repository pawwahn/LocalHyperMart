package com.hyperlocalmart.order.dto.diagnostics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class DiagnosticsShopDetail {

    private UUID vendorId;
    private String businessName;
    private BigDecimal homeCollectionFee;
    private boolean eligible;
    private String ineligibleReason;
    private UUID servingBranchId;
    private String servingBranchLabel;

    /** JSON map YYYY-MM-DD -> blocked slot template ids for the serving branch. */
    private String blockedSlotsByDate;

    @Builder.Default
    private List<DiagnosticsLabCard.TestCard> tests = new ArrayList<>();

    @Builder.Default
    private List<DiagnosticsLabCard.PackageCard> packages = new ArrayList<>();

    @Builder.Default
    private List<DiagnosticsSlotCard> slots = new ArrayList<>();

    @Data
    @Builder
    public static class DiagnosticsSlotCard {
        private UUID slotId;
        private String label;
        private String start;
        private String end;
        private int capacity;
    }
}

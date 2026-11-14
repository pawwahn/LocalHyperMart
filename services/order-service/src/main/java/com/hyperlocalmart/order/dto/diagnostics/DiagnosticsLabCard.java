package com.hyperlocalmart.order.dto.diagnostics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class DiagnosticsLabCard {

    private UUID vendorId;
    private String businessName;
    private String phone;
    private BigDecimal homeCollectionFee;
    private int activeBranchCount;

    @Builder.Default
    private List<TestCard> tests = new ArrayList<>();

    @Builder.Default
    private List<PackageCard> packages = new ArrayList<>();

    @Data
    @Builder
    public static class TestCard {
        private UUID id;
        private String code;
        private String name;
        private BigDecimal price;
        private String fastingNote;
        private boolean prescriptionRequired;
        private boolean homeCollection;
    }

    @Data
    @Builder
    public static class PackageCard {
        private UUID id;
        private String code;
        private String name;
        private String description;
        private BigDecimal price;
        @Builder.Default
        private List<UUID> testIds = new ArrayList<>();
    }
}

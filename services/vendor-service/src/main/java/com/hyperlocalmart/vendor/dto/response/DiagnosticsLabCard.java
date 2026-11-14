package com.hyperlocalmart.vendor.dto.response;

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
    private UUID townId;
    private String businessName;
    private String serviceFor;
    private String phone;
    private String vendorStatus;
    private boolean enabled;
    private boolean bookable;
    private BigDecimal homeCollectionFee;
    private int activeBranchCount;

    @Builder.Default
    private List<TestRow> tests = new ArrayList<>();

    @Builder.Default
    private List<PackageRow> packages = new ArrayList<>();

    @Data
    @Builder
    public static class TestRow {
        private UUID id;
        private String code;
        private String name;
        private BigDecimal price;
        private String fastingNote;
        private boolean prescriptionRequired;
        private boolean homeCollection;
        /** Present on bookable-lab cards so downstream services can filter without a detail fetch. */
        private boolean active;
    }

    @Data
    @Builder
    public static class PackageRow {
        private UUID id;
        private String code;
        private String name;
        private String description;
        private BigDecimal price;
        private boolean active;
        @Builder.Default
        private List<UUID> testIds = new ArrayList<>();
    }
}

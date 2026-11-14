package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class DiagnosticsLabDetailResponse {

    private UUID vendorId;
    private UUID townId;
    private String businessName;
    private String serviceFor;
    private String phone;
    private String vendorStatus;
    private boolean enabled;
    private boolean bookable;
    private BigDecimal homeCollectionFee;

    /** Commercial terms (same fields as laundry shop profile). */
    private String feeModel;
    private BigDecimal perPieceAmount;
    private BigDecimal perOrderFlatAmount;
    private BigDecimal monthlySubscriptionAmount;

    @Builder.Default
    private List<BranchRow> branches = new ArrayList<>();

    @Builder.Default
    private List<TestRow> tests = new ArrayList<>();

    @Builder.Default
    private List<PackageRow> packages = new ArrayList<>();

    @Builder.Default
    private List<StaffRow> staff = new ArrayList<>();

    @Builder.Default
    private List<AuditRow> audit = new ArrayList<>();

    @Data
    @Builder
    public static class BranchRow {
        private UUID id;
        private String label;
        private String addressLine;
        private Double latitude;
        private Double longitude;
        private BigDecimal homeCollectionRadiusKm;
        private boolean active;
        private int sortOrder;
        private String blockedSlotsByDate;
        @Builder.Default
        private List<SlotRow> slots = new ArrayList<>();
    }

    @Data
    @Builder
    public static class SlotRow {
        private UUID id;
        private String label;
        private String startTime;
        private String endTime;
        private int capacity;
        private boolean active;
    }

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
        private boolean active;
        private int sortOrder;
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
        private int sortOrder;
        @Builder.Default
        private List<UUID> testIds = new ArrayList<>();
    }

    @Data
    @Builder
    public static class StaffRow {
        private UUID id;
        private UUID userId;
        private String phone;
        private String displayName;
        private String roleType;
        private String title;
        private boolean collectionCapable;
        private boolean active;
    }

    @Data
    @Builder
    public static class AuditRow {
        private UUID id;
        private String eventType;
        private String createdAt;
        private UUID actorStaffId;
    }
}

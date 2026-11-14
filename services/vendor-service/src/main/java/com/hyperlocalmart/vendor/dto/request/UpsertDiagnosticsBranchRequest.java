package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class UpsertDiagnosticsBranchRequest {

    @NotBlank
    @Size(max = 120)
    private String label;

    @NotBlank
    @Size(max = 500)
    private String addressLine;

    private Double latitude;
    private Double longitude;
    private BigDecimal homeCollectionRadiusKm;
    private Boolean active;
    private Integer sortOrder;

    /**
     * Must be {@code null} when the client omits {@code slots} in JSON — otherwise Jackson fills an empty list
     * and {@code updateBranch} would wipe existing templates on block-only updates.
     */
    private List<SlotInput> slots;

    /** Full JSON map of manual blocks (optional). */
    private String blockedSlotsByDate;

    /** Toggle blocks for one day (optional, with {@link #blockedSlotIds}). */
    private LocalDate blockedSlotDate;

    private String blockedSlotIds;

    @Data
    public static class SlotInput {
        private UUID id;
        private String label;
        private String startTime;
        private String endTime;
        private Integer capacity;
        private Boolean active;
    }
}

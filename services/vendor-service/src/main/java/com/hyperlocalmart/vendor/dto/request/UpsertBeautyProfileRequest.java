package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class UpsertBeautyProfileRequest {

    @NotNull
    private Boolean enabled;

    private String tagline;
    private Integer yearsExperience;
    private BigDecimal ratingScore;
    private Integer ratingCount;
    private BigDecimal homeVisitCharge;
    private String studioAddress;
    private String closedWeekdays;
    private String blockedSlotDate;
    private String blockedSlotIds;
    private Integer staffCount;
    private String slotDayOpen;
    private String slotDayClose;
    private Integer slotIntervalMinutes;

    /** Admin only: minimum INR for partial prepay; 0 disables partial (full payment required). */
    @DecimalMin("0.0")
    private BigDecimal bookingMinPrepayAmount;

    @Valid
    private List<RateInput> rates = new ArrayList<>();

    /** Labels for custom treatment codes (CUS_*). */
    @Valid
    private List<CustomTreatmentInput> customTreatments = new ArrayList<>();

    @Data
    public static class CustomTreatmentInput {
        @NotNull
        private String serviceCode;
        @NotNull
        private String label;
        private String hint;
        private String emoji;
    }

    @Data
    public static class RateInput {
        @NotNull
        private String serviceType;
        @NotNull
        private BigDecimal unitPrice;
        private Integer durationMinutes;
        private Boolean paused;
    }
}

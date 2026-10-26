package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class UpsertBeautyRatesRequest {

    @NotNull
    @Valid
    private List<RateInput> rates = new ArrayList<>();

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

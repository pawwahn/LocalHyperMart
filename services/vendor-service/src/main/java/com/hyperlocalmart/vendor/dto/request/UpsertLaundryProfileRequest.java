package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class UpsertLaundryProfileRequest {

    private Boolean enabled;

    private Boolean priceEditAllowed;

    @Min(1)
    private Integer dailyPieceCapacity;

    /** True clears the daily cap. */
    private Boolean clearDailyPieceCapacity;

    /** Day names: MONDAY … SUNDAY. Empty means open every day. */
    private String closedWeekdays;

    @DecimalMin("0.0")
    private BigDecimal pickupCharge;

    @DecimalMin("0.0")
    private BigDecimal dropCharge;

    @DecimalMin("0.0")
    private BigDecimal pickupAndDropCharge;

    @Valid
    private List<RateInput> rates = new ArrayList<>();

    @Data
    public static class RateInput {
        @NotNull
        private String serviceType;

        @NotNull
        private String itemType;

        @NotNull
        @DecimalMin("0.0")
        private BigDecimal unitPrice;

        /** Null means leave the stored pause as-is. */
        private Boolean paused;
    }
}

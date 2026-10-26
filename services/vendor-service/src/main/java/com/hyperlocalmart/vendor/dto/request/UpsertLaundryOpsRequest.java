package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class UpsertLaundryOpsRequest {

    @Min(1)
    private Integer dailyPieceCapacity;

    private Boolean clearDailyPieceCapacity;

    private String closedWeekdays;

    /** Comma-separated pickup slot ids for today (08,10,12,14,16,18). Empty clears. Null leaves stored value. */
    private String blockedPickupSlots;
}

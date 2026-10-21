package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class UpsertLaundryOpsRequest {

    @Min(1)
    private Integer dailyPieceCapacity;

    private Boolean clearDailyPieceCapacity;

    private String closedWeekdays;
}

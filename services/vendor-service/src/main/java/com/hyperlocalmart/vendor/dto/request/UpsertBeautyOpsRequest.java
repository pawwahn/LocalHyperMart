package com.hyperlocalmart.vendor.dto.request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertBeautyOpsRequest {

    /** Comma-separated 45-min slot ids (HHmm). Empty clears blocks for the date. Null leaves stored value. */
    private String blockedSlotIds;

    /** Date (YYYY-MM-DD) for manual blocks; defaults to today in IST when blocking slots. */
    private String blockedSlotDate;

    /** Parallel bookings per slot (number of professionals). Null leaves stored value. */
    private Integer staffCount;

    /** Shop hours for bookings (HH:mm IST). Null leaves stored value. */
    private String slotDayOpen;
    private String slotDayClose;
    /** Slot length in minutes: 15, 30, 45, or 60. Null leaves stored value. */
    private Integer slotIntervalMinutes;

    /** Override professionals for one calendar day (YYYY-MM-DD). Use with {@link #staffCountForDate}. */
    private String staffOverrideDate;

    /** Staff on that day; matching default removes the override. Null leaves overrides unchanged. */
    private Integer staffCountForDate;

    /** Extra charge (INR) when the customer books at home. Null leaves stored value. */
    private BigDecimal homeVisitCharge;
}

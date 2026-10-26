package com.hyperlocalmart.order.dto.beauty;

import lombok.Builder;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class BeautyAvailabilityResponse {

    private UUID vendorId;
    private String date;
    private int staffCount;
    private int defaultStaffCount;
    private String slotDayOpen;
    private String slotDayClose;
    private int slotIntervalMinutes;

    @Builder.Default
    private List<SlotAvailability> slots = new ArrayList<>();

    @Data
    @Builder
    public static class SlotAvailability {
        private String slotId;
        private int booked;
        private int capacity;
        private boolean manuallyBlocked;
    }
}

package com.hyperlocalmart.order.dto.beauty;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class BeautyArtistCard {

    private UUID vendorId;
    private String businessName;
    private String serviceFor;
    private String phone;
    private String tagline;
    private Integer yearsExperience;
    private BigDecimal ratingScore;
    private int ratingCount;
    private BigDecimal homeVisitCharge;
    private String studioAddress;
    private String closedWeekdays;
    private String blockedSlotDate;
    private String blockedSlotIds;
    private String blockedSlotsByDate;
    private int staffCount;
    private String slotDayOpen;
    private String slotDayClose;
    private int slotIntervalMinutes;
    private BigDecimal bookingMinPrepayAmount;

    @Builder.Default
    private List<ServiceRate> rates = new ArrayList<>();

    @Builder.Default
    private List<WorkPhoto> workPhotos = new ArrayList<>();

    /** Recent buyer comments (public, no personal details). */
    @Builder.Default
    private List<BeautyCustomerReview> customerReviews = new ArrayList<>();

    @Data
    @Builder
    public static class WorkPhoto {
        private UUID mediaId;
        private String url;
    }

    @Data
    @Builder
    public static class ServiceRate {
        private String serviceType;
        private String label;
        private String hint;
        private String emoji;
        private BigDecimal unitPrice;
        private int durationMinutes;
        private boolean paused;
    }
}

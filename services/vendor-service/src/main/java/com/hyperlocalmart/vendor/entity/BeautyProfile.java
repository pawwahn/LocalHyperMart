package com.hyperlocalmart.vendor.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "beauty_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BeautyProfile extends BaseAuditEntity {

    @Id
    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = false;

    @Column(length = 200)
    private String tagline;

    @Column(name = "years_experience")
    private Integer yearsExperience;

    @Column(name = "rating_score", nullable = false, precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal ratingScore = new BigDecimal("4.80");

    @Column(name = "rating_count", nullable = false)
    @Builder.Default
    private int ratingCount = 0;

    @Column(name = "home_visit_charge", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal homeVisitCharge = BigDecimal.ZERO;

    @Column(name = "studio_address", length = 300)
    private String studioAddress;

    @Column(name = "closed_weekdays", nullable = false, length = 80)
    @Builder.Default
    private String closedWeekdays = "";

    @Column(name = "blocked_slot_date")
    private LocalDate blockedSlotDate;

    @Column(name = "blocked_slot_ids", nullable = false, length = 512)
    @Builder.Default
    private String blockedSlotIds = "";

    @Column(name = "blocked_slots_by_date", nullable = false, length = 4000)
    @Builder.Default
    private String blockedSlotsByDate = "{}";

    @Column(name = "staff_count", nullable = false)
    @Builder.Default
    private int staffCount = 1;

    @Column(name = "slot_day_open", nullable = false)
    @Builder.Default
    private LocalTime slotDayOpen = LocalTime.of(8, 0);

    @Column(name = "slot_day_close", nullable = false)
    @Builder.Default
    private LocalTime slotDayClose = LocalTime.of(20, 0);

    @Column(name = "slot_interval_minutes", nullable = false)
    @Builder.Default
    private int slotIntervalMinutes = 45;

    /** JSON map {@code {"YYYY-MM-DD":staffCount}} for days with fewer/more professionals than default. */
    @Column(name = "staff_overrides", nullable = false, length = 4000)
    @Builder.Default
    private String staffOverrides = "{}";

    /** Minimum INR prepay when buyer selects partial payment (admin only). 0 = full payment only. */
    @Column(name = "booking_min_prepay_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal bookingMinPrepayAmount = BigDecimal.ZERO;
}

package com.hyperlocalmart.order.dto.beauty;

import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class BeautyOrderResponse {

    private UUID id;
    private String orderNumber;
    private UUID townId;
    private UUID vendorId;
    private String artistName;
    private UUID buyerId;
    private String occasion;
    private String serviceType;
    private String serviceLabel;
    /** Comma-separated codes as stored on the order. */
    private String serviceTypes;
    /** Human-readable label per booked treatment. */
    @Builder.Default
    private List<String> bookedServiceLabels = new ArrayList<>();
    private String venue;
    private String venueLabel;
    private String status;
    private String statusLabel;
    private String paymentMethod;
    private String paymentStatus;
    private BigDecimal serviceAmount;
    private BigDecimal travelCharge;
    private BigDecimal platformFeeAmount;
    private BigDecimal codFee;
    private BigDecimal parlourPaymentFee;
    private BigDecimal amountCollected;
    private BigDecimal amountDueTotal;
    private BigDecimal balanceDue;
    private BigDecimal prepayAmount;
    private int durationMinutes;
    private String specialInstructions;
    private UUID referencePhotoMediaId;
    private String referencePhotoUrl;
    private String addressText;
    private String studioAddress;
    private String contactName;
    private String contactPhone;
    private Instant slotStart;
    private Instant slotEnd;
    private Instant placedAt;
    private Instant completedAt;
    private PaymentInfoResponse payment;
    private String prepayMode;
    private Integer myRatingStars;
    private boolean canRateBooking;

    @Builder.Default
    private List<String> allowedActions = new ArrayList<>();
}

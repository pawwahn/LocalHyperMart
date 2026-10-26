package com.hyperlocalmart.order.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import com.hyperlocalmart.order.beauty.BeautyOrderStatus;
import com.hyperlocalmart.order.beauty.BeautyPaymentMethod;
import com.hyperlocalmart.order.beauty.BeautyPaymentStatus;
import com.hyperlocalmart.order.beauty.BeautyVenue;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "beauty_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BeautyOrder extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_number", nullable = false, length = 24)
    private String orderNumber;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "artist_name", nullable = false, length = 150)
    private String artistName;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Column(length = 30)
    private String occasion;

    @Column(name = "service_type", nullable = false, length = 30)
    private String serviceType;

    /** Comma-separated service codes when buyer books multiple treatments. */
    @Column(name = "service_types", length = 250)
    private String serviceTypes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BeautyVenue venue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BeautyOrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    private BeautyPaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 20)
    private BeautyPaymentStatus paymentStatus;

    @Column(name = "service_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal serviceAmount;

    @Column(name = "travel_charge", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal travelCharge = BigDecimal.ZERO;

    @Column(name = "platform_fee_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal platformFeeAmount = BigDecimal.ZERO;

    @Column(name = "cod_fee", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal codFee = BigDecimal.ZERO;

    @Column(name = "parlour_payment_fee", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal parlourPaymentFee = BigDecimal.ZERO;

    @Column(name = "amount_collected", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal amountCollected = BigDecimal.ZERO;

    @Column(name = "amount_due_total", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal amountDueTotal = BigDecimal.ZERO;

    /** Amount for the current / latest online payment intent (prepay or balance). */
    @Column(name = "prepay_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal prepayAmount = BigDecimal.ZERO;

    /** FULL or PARTIAL checkout at booking (glam scratch eligibility). */
    @Column(name = "prepay_mode", nullable = false, length = 10)
    @Builder.Default
    private String prepayMode = "FULL";

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(name = "special_instructions", length = 400)
    private String specialInstructions;

    @Column(name = "reference_photo_media_id")
    private UUID referencePhotoMediaId;

    @Column(name = "address_id")
    private UUID addressId;

    @Column(name = "address_text", length = 500)
    private String addressText;

    @Column(name = "studio_address", length = 300)
    private String studioAddress;

    @Column(name = "contact_name", length = 120)
    private String contactName;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "slot_start", nullable = false)
    private Instant slotStart;

    @Column(name = "slot_end", nullable = false)
    private Instant slotEnd;

    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;

    @Column(name = "completed_at")
    private Instant completedAt;
}

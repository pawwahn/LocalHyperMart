package com.hyperlocalmart.payment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vendor_settlement_adjustments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VendorSettlementAdjustment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "shop_id")
    private UUID shopId;

    @Column(name = "claim_id", nullable = false, unique = true)
    private UUID claimId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    /** Display number e.g. NRPT/AP-260722-0001 — shown to vendors. */
    @Column(name = "order_number", length = 64)
    private String orderNumber;

    @Column(name = "order_item_id", nullable = false)
    private UUID orderItemId;

    @Column(name = "sub_order_id", nullable = false)
    private UUID subOrderId;

    /** Positive amount to deduct from vendor payout. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private VendorSettlementAdjustmentStatus status = VendorSettlementAdjustmentStatus.PENDING;

    @Column(name = "applied_settlement_id")
    private UUID appliedSettlementId;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}

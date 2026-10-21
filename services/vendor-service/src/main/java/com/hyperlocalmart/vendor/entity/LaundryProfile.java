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
import java.util.UUID;

@Entity
@Table(name = "laundry_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LaundryProfile extends BaseAuditEntity {

    @Id
    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "price_edit_allowed", nullable = false)
    private boolean priceEditAllowed;

    @Column(name = "daily_piece_capacity")
    private Integer dailyPieceCapacity;

    @Column(name = "closed_weekdays", nullable = false, length = 80)
    @Builder.Default
    private String closedWeekdays = "";

    @Column(name = "pickup_charge", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal pickupCharge = BigDecimal.ZERO;

    @Column(name = "drop_charge", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal dropCharge = BigDecimal.ZERO;

    @Column(name = "pickup_and_drop_charge", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal pickupAndDropCharge = BigDecimal.ZERO;
}

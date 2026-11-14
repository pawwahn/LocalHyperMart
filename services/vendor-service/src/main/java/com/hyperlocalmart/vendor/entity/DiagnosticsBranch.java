package com.hyperlocalmart.vendor.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import java.util.UUID;

@Entity
@Table(name = "diagnostics_branches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagnosticsBranch extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(nullable = false, length = 120)
    private String label;

    @Column(name = "address_line", nullable = false, length = 500)
    private String addressLine;

    private Double latitude;

    private Double longitude;

    @Column(name = "home_collection_radius_km", nullable = false, precision = 6, scale = 2)
    @Builder.Default
    private BigDecimal homeCollectionRadiusKm = new BigDecimal("5.00");

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "blocked_slots_by_date", nullable = false, columnDefinition = "TEXT")
    @Builder.Default
    private String blockedSlotsByDate = "{}";
}

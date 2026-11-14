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
@Table(name = "diagnostics_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagnosticsProfile extends BaseAuditEntity {

    @Id
    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = false;

    @Column(name = "home_collection_fee", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal homeCollectionFee = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private boolean bookable = false;
}

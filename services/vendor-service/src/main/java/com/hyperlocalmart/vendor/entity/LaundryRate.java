package com.hyperlocalmart.vendor.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import com.hyperlocalmart.vendor.laundry.LaundryItemType;
import com.hyperlocalmart.vendor.laundry.LaundryServiceType;
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
import java.util.UUID;

@Entity
@Table(name = "laundry_rates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LaundryRate extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false, length = 30)
    private LaundryServiceType serviceType;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 40)
    private LaundryItemType itemType;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "paused", nullable = false)
    private boolean paused;
}

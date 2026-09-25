package com.hyperlocalmart.town.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "ad_rate_cards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdRateCard extends BaseAuditEntity {

    public static final UUID SINGLETON_ID = UUID.fromString("00000000-0000-0000-0000-00000000ad01");

    @Id
    @Builder.Default
    private UUID id = SINGLETON_ID;

    @Column(name = "tax_percent", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal taxPercent = BigDecimal.ZERO;

    @Column(name = "rates_json", nullable = false, columnDefinition = "TEXT")
    @Builder.Default
    private String ratesJson = "{}";

    @Column(length = 500)
    private String notes;
}

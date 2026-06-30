package com.hyperlocalmart.town.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "towns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Town extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 100)
    private String state;

    @Column(name = "town_code", nullable = false, length = 10)
    private String townCode;

    @Column(name = "state_code", nullable = false, length = 10)
    private String stateCode;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @Column(name = "coverage_radius_km", nullable = false, precision = 5, scale = 2)
    private BigDecimal coverageRadiusKm;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TownStatus status;

    @OneToMany(mappedBy = "town", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<TownPincode> pincodes = new HashSet<>();

    public boolean isAcceptingOrders() {
        return status == TownStatus.ENABLED;
    }
}

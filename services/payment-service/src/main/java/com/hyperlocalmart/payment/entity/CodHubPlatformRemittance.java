package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "cod_hub_platform_remittances")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodHubPlatformRemittance extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "hub_id", nullable = false)
    private UUID hubId;

    @Column(name = "remittance_date", nullable = false)
    private LocalDate remittanceDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 120)
    private String reference;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "submission_id")
    private UUID submissionId;
}

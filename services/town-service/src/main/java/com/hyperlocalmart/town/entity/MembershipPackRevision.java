package com.hyperlocalmart.town.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "membership_pack_revisions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MembershipPackRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @Column(name = "selling_enabled", nullable = false)
    private boolean sellingEnabled;

    @Column(name = "quarterly_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal quarterlyPrice;

    @Column(name = "quarterly_credits", nullable = false)
    private int quarterlyCredits;

    @Column(name = "half_year_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal halfYearPrice;

    @Column(name = "half_year_credits", nullable = false)
    private int halfYearCredits;

    @Column(name = "annual_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal annualPrice;

    @Column(name = "annual_credits", nullable = false)
    private int annualCredits;

    @Column(name = "change_summary", nullable = false, length = 500)
    @Builder.Default
    private String changeSummary = "";

    @Column(name = "changed_by")
    private UUID changedBy;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

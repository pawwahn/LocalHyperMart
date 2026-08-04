package com.hyperlocalmart.vendor.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "vendor_commercial_terms")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VendorCommercialTerms extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "fee_model", nullable = false, length = 40)
    private VendorFeeModel feeModel;

    @Column(name = "commission_percent", precision = 8, scale = 4)
    private BigDecimal commissionPercent;

    @Column(name = "per_order_flat_amount", precision = 12, scale = 2)
    private BigDecimal perOrderFlatAmount;

    @Column(name = "monthly_subscription_amount", precision = 12, scale = 2)
    private BigDecimal monthlySubscriptionAmount;

    @Column(name = "subscription_billing_day")
    private Integer subscriptionBillingDay;

    @Column(name = "commission_slabs_json", columnDefinition = "TEXT")
    private String commissionSlabsJson;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    /** Inclusive end date. Null = currently open version. */
    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    /** YYYY-MM of last month for which subscription was deducted on a payout. */
    @Column(name = "last_subscription_charged_ym", length = 7)
    private String lastSubscriptionChargedYm;
}

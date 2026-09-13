package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "buyer_membership_ledger")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BuyerMembershipLedger extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Column(name = "membership_id", nullable = false)
    private UUID membershipId;

    @Column(name = "purchase_id")
    private UUID purchaseId;

    @Column(name = "order_id")
    private UUID orderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 20)
    private MembershipLedgerType entryType;

    @Column(name = "credits_delta", nullable = false)
    private int creditsDelta;

    @Column(name = "delivery_fee_waived", precision = 12, scale = 2)
    private BigDecimal deliveryFeeWaived;

    @Column(length = 255)
    private String note;
}

package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "buyer_membership_purchases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BuyerMembershipPurchase extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Column(name = "buyer_phone_snapshot", length = 15)
    private String buyerPhoneSnapshot;

    @Column(name = "town_id")
    private UUID townId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MembershipSlab slab;

    @Column(name = "duration_months", nullable = false)
    private int durationMonths;

    @Column(name = "credits_granted", nullable = false)
    private int creditsGranted;

    @Column(name = "price_snapshot", nullable = false, precision = 12, scale = 2)
    private BigDecimal priceSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_channel", nullable = false, length = 20)
    private MembershipPaymentChannel paymentChannel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MembershipPurchaseStatus status;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "confirmed_by")
    private UUID confirmedBy;

    @Column(name = "expires_at_after")
    private Instant expiresAtAfter;

    @Column(length = 255)
    private String note;

    @Column(name = "gateway_order_id")
    private String gatewayOrderId;

    @Column(name = "gateway_payment_id")
    private String gatewayPaymentId;
}

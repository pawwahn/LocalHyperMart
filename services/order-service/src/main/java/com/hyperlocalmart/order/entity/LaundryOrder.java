package com.hyperlocalmart.order.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import com.hyperlocalmart.order.laundry.LaundryLogistics;
import com.hyperlocalmart.order.laundry.LaundryOrderStatus;
import com.hyperlocalmart.order.laundry.LaundryPaymentMethod;
import com.hyperlocalmart.order.laundry.LaundryPaymentStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "laundry_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LaundryOrder extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_number", nullable = false, length = 24)
    private String orderNumber;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "shop_name", nullable = false, length = 150)
    private String shopName;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LaundryLogistics logistics;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LaundryOrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    private LaundryPaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 20)
    private LaundryPaymentStatus paymentStatus;

    @Column(name = "goods_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal goodsAmount;

    @Column(name = "logistics_charge", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal logisticsCharge = BigDecimal.ZERO;

    @Column(name = "amount_collected", nullable = false, precision = 12, scale = 2)
    private BigDecimal amountCollected;

    @Column(name = "platform_fee_model", length = 40)
    private String platformFeeModel;

    @Column(name = "platform_per_piece", precision = 12, scale = 2)
    private BigDecimal platformPerPiece;

    @Column(name = "platform_per_order", precision = 12, scale = 2)
    private BigDecimal platformPerOrder;

    @Column(name = "platform_fee_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal platformFeeAmount;

    /** Town COD charge snapshotted when the buyer pays cash. Zero for UPI. */
    @Column(name = "cod_fee", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal codFee = BigDecimal.ZERO;

    @Column(name = "piece_count", nullable = false)
    private int pieceCount;

    @Column(name = "special_instructions", length = 400)
    private String specialInstructions;

    @Column(name = "address_id", nullable = false)
    private UUID addressId;

    @Column(name = "address_text", nullable = false, length = 500)
    private String addressText;

    @Column(name = "contact_name", length = 120)
    private String contactName;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "requested_pickup_start")
    private Instant requestedPickupStart;

    @Column(name = "requested_pickup_end")
    private Instant requestedPickupEnd;

    @Column(name = "pickup_slot_start")
    private Instant pickupSlotStart;

    @Column(name = "pickup_slot_end")
    private Instant pickupSlotEnd;

    @Column(name = "estimated_ready_at")
    private Instant estimatedReadyAt;

    @Column(name = "buyer_comment", length = 400)
    private String buyerComment;

    @Column(name = "vendor_comment", length = 400)
    private String vendorComment;

    @Column(name = "wallet_credited", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal walletCredited = BigDecimal.ZERO;

    @Column(name = "pickup_reschedule_count", nullable = false)
    private int pickupRescheduleCount;

    @Column(name = "rewash_used", nullable = false)
    private boolean rewashUsed;

    @Column(name = "complaint_open", nullable = false)
    private boolean complaintOpen;

    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<LaundryOrderLine> lines = new ArrayList<>();
}

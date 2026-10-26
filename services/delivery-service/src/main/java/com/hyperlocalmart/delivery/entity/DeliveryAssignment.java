package com.hyperlocalmart.delivery.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "delivery_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryAssignment extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "assignment_number", unique = true, length = 60)
    private String assignmentNumber;

    @Column(name = "order_number", length = 40)
    private String orderNumber;

    @Column(name = "sub_order_number", length = 50)
    private String subOrderNumber;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "vendor_sub_order_id")
    private UUID vendorSubOrderId;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "hub_id")
    private UUID hubId;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "leg_type", nullable = false, length = 20)
    private AssignmentLegType legType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private AssignmentStatus status = AssignmentStatus.ASSIGNED;

    @Column(name = "assigned_by")
    private UUID assignedBy;

    @Column(name = "assigned_at", nullable = false)
    @Builder.Default
    private Instant assignedAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "source_shop_name", length = 150)
    private String sourceShopName;

    @Column(name = "destination_name", length = 120)
    private String destinationName;

    @Column(name = "destination_phone", length = 20)
    private String destinationPhone;

    @Column(name = "destination_address", length = 500)
    private String destinationAddress;

    @Column(name = "laundry_trip_kind", length = 30)
    private String laundryTripKind;

    @Column(name = "trip_payment_method", length = 20)
    private String tripPaymentMethod;

    @Column(name = "trip_collect_cash", precision = 12, scale = 2)
    private BigDecimal tripCollectCash;
}

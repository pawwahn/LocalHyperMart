package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "settlement_line_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SettlementLineItem extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "settlement_id", nullable = false)
    private Settlement settlement;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "sub_order_id", nullable = false)
    private UUID subOrderId;

    @Column(name = "order_number", length = 50)
    private String orderNumber;

    @Column(name = "sub_order_number", length = 50)
    private String subOrderNumber;

    @Column(name = "line_type", nullable = false, length = 30)
    @Builder.Default
    private String lineType = "ORDER";

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(columnDefinition = "TEXT")
    private String description;
}

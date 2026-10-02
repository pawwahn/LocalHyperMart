package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "cod_close_day_allocations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodCloseDayAllocation extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "close_day_line_id", nullable = false)
    private CodCloseDayLineItem closeDayLine;

    @Column(name = "sub_order_id", nullable = false)
    private UUID subOrderId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "sub_order_number", length = 50)
    private String subOrderNumber;

    @Column(name = "goods_subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal goodsSubtotal;

    @Column(name = "allocated_cash", nullable = false, precision = 12, scale = 2)
    private BigDecimal allocatedCash;
}

package com.hyperlocalmart.order.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "laundry_order_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LaundryOrderLine extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private LaundryOrder order;

    @Column(name = "service_type", nullable = false, length = 30)
    private String serviceType;

    @Column(name = "item_type", nullable = false, length = 30)
    private String itemType;

    @Column(name = "other_label", length = 80)
    private String otherLabel;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "confirmed_quantity", nullable = false)
    private int confirmedQuantity;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "condition_note", length = 200)
    private String conditionNote;

    @Column(name = "photo_media_id")
    private UUID photoMediaId;

    @Column(name = "photo_deleted_at")
    private Instant photoDeletedAt;
}

package com.hyperlocalmart.catalog.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "master_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterItem extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false)
    private String name;

    private String description;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    private BigDecimal mrp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CatalogItemStatus status;
}

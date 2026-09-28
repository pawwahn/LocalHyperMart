package com.hyperlocalmart.catalog.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    /** Comma-separated alternate names. Search-only; the product card still uses name. */
    @Column(name = "search_names", length = 500)
    private String searchNames;

    private String description;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    private BigDecimal mrp;

    @Column(name = "hsn_code", nullable = false, length = 8)
    private String hsnCode;

    @Column(name = "gst_percent", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal gstPercent = new BigDecimal("18.00");

    @Column(name = "cess_percent", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal cessPercent = BigDecimal.ZERO;

    @Column(name = "price_includes_tax", nullable = false)
    @Builder.Default
    private boolean priceIncludesTax = true;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "country_of_origin", nullable = false, length = 2)
    @Builder.Default
    private String countryOfOrigin = "IN";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CatalogItemStatus status;
}

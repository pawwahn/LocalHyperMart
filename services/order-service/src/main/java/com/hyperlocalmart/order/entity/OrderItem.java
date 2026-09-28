package com.hyperlocalmart.order.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vendor_sub_order_id", nullable = false)
    private VendorSubOrder vendorSubOrder;

    @Column(name = "listing_id", nullable = false)
    private UUID listingId;

    @Column(name = "master_item_id", nullable = false)
    private UUID masterItemId;

    @Column(name = "item_name_snapshot", nullable = false)
    private String itemNameSnapshot;

    @Column(name = "unit_code_snapshot", length = 20)
    private String unitCodeSnapshot;

    @Column(name = "shop_name_snapshot")
    private String shopNameSnapshot;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "discount_price", precision = 12, scale = 2)
    private BigDecimal discountPrice;

    @Column(name = "line_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal;

    @Column(name = "hsn_code_snapshot", length = 8)
    private String hsnCodeSnapshot;

    @Column(name = "gst_percent_snapshot", precision = 5, scale = 2)
    private BigDecimal gstPercentSnapshot;

    @Column(name = "cess_percent_snapshot", precision = 5, scale = 2)
    private BigDecimal cessPercentSnapshot;

    @Column(name = "price_includes_tax_snapshot")
    private Boolean priceIncludesTaxSnapshot;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "country_of_origin_snapshot", length = 2)
    private String countryOfOriginSnapshot;

    @Column(name = "taxable_value", precision = 12, scale = 2)
    private BigDecimal taxableValue;

    @Column(name = "cgst_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal cgstAmount = BigDecimal.ZERO;

    @Column(name = "sgst_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal sgstAmount = BigDecimal.ZERO;

    @Column(name = "igst_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal igstAmount = BigDecimal.ZERO;

    @Column(name = "cess_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal cessAmount = BigDecimal.ZERO;

    @Column(name = "line_tax_total", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal lineTaxTotal = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private OrderItemStatus status = OrderItemStatus.ACTIVE;

    @Column(name = "cancel_reason", columnDefinition = "TEXT")
    private String cancelReason;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancelled_by")
    private UUID cancelledBy;

    @Column(name = "store_credit_amount", precision = 12, scale = 2)
    private BigDecimal storeCreditAmount;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    public boolean isActiveLine() {
        return status == null || status == OrderItemStatus.ACTIVE;
    }
}

package com.hyperlocalmart.town.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "ad_invoices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdInvoice extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "invoice_number", nullable = false, unique = true, length = 40)
    private String invoiceNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AdInvoiceStatus status;

    @Column(name = "advertiser_name", nullable = false, length = 160)
    private String advertiserName;

    @Column(name = "advertiser_phone", nullable = false, length = 20)
    private String advertiserPhone;

    @Column(name = "advertiser_gstin", length = 20)
    private String advertiserGstin;

    @Column(length = 500)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TownAdSlot slot;

    @Column(name = "slot_index", nullable = false)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Builder.Default
    private int slotIndex = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AdBillPeriod period;

    @Enumerated(EnumType.STRING)
    @Column(name = "town_scope", nullable = false, length = 20)
    private AdTownScope townScope;

    @Column(name = "all_towns", nullable = false)
    @Builder.Default
    private boolean allTowns = false;

    @Column(name = "town_ids_json", nullable = false, columnDefinition = "TEXT")
    @Builder.Default
    private String townIdsJson = "[]";

    @Column(name = "from_date", nullable = false)
    private LocalDate fromDate;

    @Column(name = "to_date", nullable = false)
    private LocalDate toDate;

    @Column(name = "calendar_days", nullable = false)
    private int calendarDays;

    @Column(name = "billable_units", nullable = false)
    private int billableUnits;

    @Column(name = "unit_one_town", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitOneTown;

    @Column(name = "unit_extra_town", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitExtraTown;

    @Column(name = "unit_all_towns", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitAllTowns;

    @Column(name = "tax_percent", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal taxPercent = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "tax_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxAmount;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "paid_method", length = 20)
    private String paidMethod;

    @Column(name = "paid_reference", length = 80)
    private String paidReference;

    @Column(name = "paid_by")
    private UUID paidBy;

    @Column(name = "voided_at")
    private Instant voidedAt;

    @Column(name = "void_reason", length = 240)
    private String voidReason;

    @Column(name = "voided_by")
    private UUID voidedBy;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "issued_by")
    private UUID issuedBy;
}

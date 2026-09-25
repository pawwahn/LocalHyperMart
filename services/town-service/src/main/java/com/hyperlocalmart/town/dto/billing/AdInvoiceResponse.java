package com.hyperlocalmart.town.dto.billing;

import com.hyperlocalmart.town.entity.AdBillPeriod;
import com.hyperlocalmart.town.entity.AdInvoiceStatus;
import com.hyperlocalmart.town.entity.AdTownScope;
import com.hyperlocalmart.town.entity.TownAdSlot;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdInvoiceResponse {

    private UUID id;
    private String invoiceNumber;
    private AdInvoiceStatus status;
    private String advertiserName;
    private String advertiserPhone;
    private String advertiserGstin;
    private String notes;
    private TownAdSlot slot;
    private int slotIndex;
    private String slotLabel;
    private AdBillPeriod period;
    private AdTownScope townScope;
    private boolean allTowns;
    private List<UUID> townIds;
    private List<AdInvoiceTownDto> towns;
    private int townCount;
    private LocalDate fromDate;
    private LocalDate toDate;
    private int calendarDays;
    private int billableUnits;
    private BigDecimal unitOneTown;
    private BigDecimal unitExtraTown;
    private BigDecimal unitAllTowns;
    private BigDecimal unitRate;
    private BigDecimal taxPercent;
    private BigDecimal subtotal;
    private BigDecimal taxAmount;
    private BigDecimal total;
    private String breakdown;
    private Instant paidAt;
    private String paidMethod;
    private String paidReference;
    private Instant voidedAt;
    private String voidReason;
    private Instant issuedAt;
    private UUID issuedBy;
    /** LIVE = running now, PREORDER = future hold, ENDED = dates passed. */
    private String bookingPhase;
}

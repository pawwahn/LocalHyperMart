package com.hyperlocalmart.town.dto.billing;

import com.hyperlocalmart.town.entity.AdBillPeriod;
import com.hyperlocalmart.town.entity.AdTownScope;
import com.hyperlocalmart.town.entity.TownAdSlot;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdQuoteResponse {

    private TownAdSlot slot;
    private int slotIndex;
    private String slotLabel;
    private AdBillPeriod period;
    private AdTownScope townScope;
    private boolean allTowns;
    private List<UUID> townIds;
    private List<AdInvoiceTownDto> towns;
    private int townCount;
    private int enabledTownCount;
    private LocalDate fromDate;
    private LocalDate toDate;
    private int calendarDays;
    private int billableUnits;
    private BigDecimal unitOneTown;
    private BigDecimal unitExtraTown;
    private BigDecimal unitAllTowns;
    private BigDecimal unitRate;
    private BigDecimal subtotal;
    private BigDecimal taxPercent;
    private BigDecimal taxAmount;
    private BigDecimal total;
    private String breakdown;
    private List<AdInvoiceConflictDto> conflicts;
    private boolean available;
    private LocalDate nextFreeFrom;
    private LocalDate nextFreeTo;
}

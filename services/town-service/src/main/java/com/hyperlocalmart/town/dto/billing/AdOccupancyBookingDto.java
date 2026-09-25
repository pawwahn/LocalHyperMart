package com.hyperlocalmart.town.dto.billing;

import com.hyperlocalmart.town.entity.AdInvoiceStatus;
import com.hyperlocalmart.town.entity.TownAdSlot;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdOccupancyBookingDto {

    private UUID invoiceId;
    private String invoiceNumber;
    private String advertiserName;
    private AdInvoiceStatus status;
    private TownAdSlot slot;
    private int slotIndex;
    private String slotLabel;
    private LocalDate fromDate;
    private LocalDate toDate;
    private boolean allTowns;
    private List<AdInvoiceTownDto> towns;
    private String bookingPhase;
}

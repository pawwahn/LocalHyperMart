package com.hyperlocalmart.town.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdInvoiceConflictDto {

    private UUID invoiceId;
    private String invoiceNumber;
    private String advertiserName;
    private String fromDate;
    private String toDate;
    private String status;
    private String slotLabel;
    private boolean allTowns;
    private String bookingPhase;
}

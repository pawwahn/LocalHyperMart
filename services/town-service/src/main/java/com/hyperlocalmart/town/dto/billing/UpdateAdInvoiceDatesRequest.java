package com.hyperlocalmart.town.dto.billing;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateAdInvoiceDatesRequest {

    @NotNull
    private LocalDate fromDate;

    @NotNull
    private LocalDate toDate;
}

package com.hyperlocalmart.town.dto.billing;

import com.hyperlocalmart.town.entity.AdBillPeriod;
import com.hyperlocalmart.town.entity.AdTownScope;
import com.hyperlocalmart.town.entity.TownAdSlot;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class CreateAdInvoiceRequest {

    @NotBlank
    @Size(min = 2, max = 160)
    private String advertiserName;

    @NotBlank
    @Size(min = 10, max = 20)
    private String advertiserPhone;

    @Size(max = 20)
    private String advertiserGstin;

    @Size(max = 500)
    private String notes;

    @NotNull
    private TownAdSlot slot;

    private Integer slotIndex;

    @NotNull
    private AdBillPeriod period;

    @NotNull
    private AdTownScope townScope;

    private List<UUID> townIds;

    @NotNull
    private LocalDate fromDate;

    @NotNull
    private LocalDate toDate;
}

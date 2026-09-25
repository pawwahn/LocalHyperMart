package com.hyperlocalmart.town.dto.billing;

import com.hyperlocalmart.town.entity.AdBillPeriod;
import com.hyperlocalmart.town.entity.AdTownScope;
import com.hyperlocalmart.town.entity.TownAdSlot;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class AdQuoteRequest {

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

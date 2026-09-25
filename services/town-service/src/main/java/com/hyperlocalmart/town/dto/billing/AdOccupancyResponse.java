package com.hyperlocalmart.town.dto.billing;

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
public class AdOccupancyResponse {

    private LocalDate fromDate;
    private LocalDate toDate;
    private UUID townId;
    private String townName;
    private List<AdOccupancyBookingDto> bookings;
}

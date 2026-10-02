package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class DeclareCodHandoverRequest {
    private LocalDate handoverDate;
    @NotEmpty
    private List<UUID> orderIds;
}

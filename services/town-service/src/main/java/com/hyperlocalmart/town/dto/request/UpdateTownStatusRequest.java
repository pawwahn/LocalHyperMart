package com.hyperlocalmart.town.dto.request;

import com.hyperlocalmart.town.entity.TownStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateTownStatusRequest {

    @NotNull
    private TownStatus status;

    private String reason;
}

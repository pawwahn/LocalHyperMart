package com.hyperlocalmart.cart.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ChangeTownRequest {

    @NotNull
    private UUID newTownId;

    private boolean confirmClear;
}

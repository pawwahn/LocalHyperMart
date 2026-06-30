package com.hyperlocalmart.order.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RejectSubOrderRequest {

    @NotBlank
    private String reason;
}

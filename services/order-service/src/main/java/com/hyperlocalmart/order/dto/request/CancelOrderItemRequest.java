package com.hyperlocalmart.order.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CancelOrderItemRequest {

    @NotBlank
    private String reason;
}

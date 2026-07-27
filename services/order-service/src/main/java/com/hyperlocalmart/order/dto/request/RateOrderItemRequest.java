package com.hyperlocalmart.order.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class RateOrderItemRequest {

    @NotNull
    private UUID orderItemId;

    @NotNull
    @Min(1)
    @Max(5)
    private Integer stars;
}

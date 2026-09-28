package com.hyperlocalmart.order.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RateDeliveryAgentRequest {

    @NotNull
    @Min(1)
    @Max(5)
    private Integer stars;

    @Size(max = 400)
    private String comment;
}

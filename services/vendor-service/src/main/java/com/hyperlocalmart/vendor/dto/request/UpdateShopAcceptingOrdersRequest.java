package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateShopAcceptingOrdersRequest {

    @NotNull
    private Boolean acceptingOrders;
}

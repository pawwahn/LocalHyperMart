package com.hyperlocalmart.cart.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class ReplaceCartItemsRequest {

    @NotEmpty
    @Valid
    private List<ReorderLineRequest> items;
}

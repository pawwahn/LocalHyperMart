package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class ShopBatchRequest {

    @NotEmpty
    private List<UUID> shopIds;
}

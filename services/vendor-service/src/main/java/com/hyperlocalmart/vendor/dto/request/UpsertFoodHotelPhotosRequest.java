package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class UpsertFoodHotelPhotosRequest {

    @NotNull
    private List<UUID> mediaIds = new ArrayList<>();
}
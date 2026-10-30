package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class UpsertBeautyWorkPhotosRequest {

    @NotNull
    @Size(max = 10)
    private List<UUID> mediaIds = new ArrayList<>();
}

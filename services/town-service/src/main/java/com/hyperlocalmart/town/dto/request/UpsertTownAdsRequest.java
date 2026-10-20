package com.hyperlocalmart.town.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UpsertTownAdsRequest {

    @NotEmpty
    @Size(min = 1, max = 10, message = "Save between 1 and 10 ad rooms")
    @Valid
    private List<UpsertTownAdRequest> items;
}

package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TownAdsResponse {

    private UUID townId;
    private List<TownAdResponse> items;
}

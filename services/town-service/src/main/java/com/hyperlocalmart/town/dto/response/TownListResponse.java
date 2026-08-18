package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TownListResponse {

    private List<TownListItemResponse> items;
    private Long total;
    private Boolean hasMore;
}

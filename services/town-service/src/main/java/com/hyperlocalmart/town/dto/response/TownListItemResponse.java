package com.hyperlocalmart.town.dto.response;

import com.hyperlocalmart.town.entity.TownStatus;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class TownListItemResponse {

    private UUID id;
    private String displayName;
    private String townCode;
    private String state;
    private String stateCode;
    private String country;
    private String countryCode;
    private TownStatus status;
    private boolean acceptingOrders;
}

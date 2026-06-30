package com.hyperlocalmart.town.dto.response;

import com.hyperlocalmart.town.entity.TownStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TownDetailResponse {

    private UUID id;
    private String name;
    private String state;
    private String displayName;
    private String townCode;
    private String stateCode;
    private BigDecimal coverageRadiusKm;
    private TownStatus status;
    private boolean acceptingOrders;
    private List<String> pincodes;
}

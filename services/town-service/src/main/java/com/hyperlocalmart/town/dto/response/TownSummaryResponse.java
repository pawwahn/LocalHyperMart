package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TownSummaryResponse {

    private String townCode;
    private String stateCode;
    private String displayName;
}

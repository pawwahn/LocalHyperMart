package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TownSummaryResponse {

    private String townCode;
    private String stateCode;
    private String displayName;
    /** Pincodes this town delivers to. Empty means checkout does not enforce a pin. */
    private List<String> pincodes;
}

package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class GeoStateResponse {
    String code;
    String name;
}

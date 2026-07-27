package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class GeoCountryResponse {
    String code;
    String name;
    List<GeoStateResponse> states;
}

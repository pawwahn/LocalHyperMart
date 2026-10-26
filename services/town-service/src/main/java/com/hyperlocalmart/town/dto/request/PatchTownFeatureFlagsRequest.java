package com.hyperlocalmart.town.dto.request;

import lombok.Data;

@Data
public class PatchTownFeatureFlagsRequest {

    private Boolean laundryEnabled;

    private Boolean beautyEnabled;
}

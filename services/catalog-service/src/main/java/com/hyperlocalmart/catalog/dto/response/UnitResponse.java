package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class UnitResponse {

    private UUID id;
    private String code;
    /** Human-readable name (same as label). */
    private String label;
    private String displayName;
}

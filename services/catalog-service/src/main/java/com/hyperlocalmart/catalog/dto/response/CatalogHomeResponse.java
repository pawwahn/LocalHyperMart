package com.hyperlocalmart.catalog.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CatalogHomeResponse {

    private List<CatalogItemResponse> featured;
    private List<CatalogItemResponse> discounted;
    private List<CatalogItemResponse> popular;
    private List<CatalogHomeRailResponse> rails;
}

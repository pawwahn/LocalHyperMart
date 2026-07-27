package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.town.dto.response.GeoCountryResponse;
import com.hyperlocalmart.town.service.GeoCatalogService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/geo")
@RequiredArgsConstructor
public class GeoController {

    private final GeoCatalogService geoCatalogService;

    @GetMapping("/countries")
    public ResponseEntity<ApiResponse<Map<String, List<GeoCountryResponse>>>> listCountries(
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                Map.of("items", geoCatalogService.listCountries())));
    }
}

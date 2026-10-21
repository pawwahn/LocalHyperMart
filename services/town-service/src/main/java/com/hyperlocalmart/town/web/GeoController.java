package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.response.GeoCountryResponse;
import com.hyperlocalmart.town.service.AddressGeocodeService;
import com.hyperlocalmart.town.service.GeoCatalogService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/geo")
@RequiredArgsConstructor
public class GeoController {

    private final GeoCatalogService geoCatalogService;
    private final AddressGeocodeService addressGeocodeService;

    @GetMapping("/countries")
    public ResponseEntity<ApiResponse<Map<String, List<GeoCountryResponse>>>> listCountries(
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                Map.of("items", geoCatalogService.listCountries())));
    }

    @GetMapping("/geocode")
    public ResponseEntity<ApiResponse<Map<String, Object>>> geocode(
            @RequestParam("q") String query,
            HttpServletRequest httpRequest) {
        AddressGeocodeService.GeoHit hit = addressGeocodeService.lookup(query)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "No map pin for that address"));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("latitude", hit.latitude());
        body.put("longitude", hit.longitude());
        body.put("label", hit.label());
        body.put("areaOnly", hit.areaOnly());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, body));
    }
}

package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.response.UnitResponse;
import com.hyperlocalmart.catalog.service.VendorListingService;
import com.hyperlocalmart.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/catalog/units")
@RequiredArgsConstructor
public class UnitController {

    private final VendorListingService vendorListingService;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<UnitResponse>>>> listUnits(
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("items", vendorListingService.listUnits())));
    }
}

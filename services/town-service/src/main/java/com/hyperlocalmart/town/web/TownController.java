package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.town.dto.response.TownDetailResponse;
import com.hyperlocalmart.town.dto.response.TownListResponse;
import com.hyperlocalmart.town.entity.TownStatus;
import com.hyperlocalmart.town.dto.response.TownOperationalConfigResponse;
import com.hyperlocalmart.town.dto.response.TownSummaryResponse;
import com.hyperlocalmart.town.service.TownConfigService;
import com.hyperlocalmart.town.service.TownService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TownController {

    private final TownService townService;
    private final TownConfigService townConfigService;

    @GetMapping("/api/v1/towns")
    public ResponseEntity<ApiResponse<TownListResponse>> listTowns(
            @RequestParam(required = false) TownStatus status,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townService.listTowns(status)));
    }

    @GetMapping("/api/v1/towns/{townId}")
    public ResponseEntity<ApiResponse<TownDetailResponse>> getTown(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townService.getTown(townId)));
    }

    @GetMapping("/api/v1/internal/towns/{townId}/exists")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> townExists(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        boolean exists = townService.existsAndEnabled(townId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("exists", exists, "acceptingOrders", exists)));
    }

    @GetMapping("/api/v1/internal/towns/{townId}/operational-config")
    public ResponseEntity<ApiResponse<TownOperationalConfigResponse>> operationalConfig(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townConfigService.getOperationalConfig(townId)));
    }

    @GetMapping("/api/v1/internal/towns/{townId}/summary")
    public ResponseEntity<ApiResponse<TownSummaryResponse>> townSummary(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townService.getTownSummary(townId)));
    }
}

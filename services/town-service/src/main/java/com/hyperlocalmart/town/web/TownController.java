package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.town.dto.request.CreateTownRequest;
import com.hyperlocalmart.town.dto.request.UpdateTownConfigRequest;
import com.hyperlocalmart.town.dto.request.UpdateTownStatusRequest;
import com.hyperlocalmart.town.dto.response.TownDetailResponse;
import com.hyperlocalmart.town.dto.response.TownListResponse;
import com.hyperlocalmart.town.dto.response.TownOperationalConfigResponse;
import com.hyperlocalmart.town.dto.response.TownSummaryResponse;
import com.hyperlocalmart.town.entity.TownStatus;
import com.hyperlocalmart.town.service.PlatformSettingsService;
import com.hyperlocalmart.town.service.TownConfigService;
import com.hyperlocalmart.town.service.TownService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TownController {

    private final TownService townService;
    private final TownConfigService townConfigService;
    private final PlatformSettingsService platformSettingsService;

    @GetMapping("/api/v1/towns")
    public ResponseEntity<ApiResponse<TownListResponse>> listTowns(
            @RequestParam(required = false) TownStatus status,
            @RequestParam(defaultValue = "false") boolean includeDisabled,
            HttpServletRequest httpRequest) {
        boolean adminAll = includeDisabled && AdminAuth.isSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townService.listTowns(status, adminAll)));
    }

    @GetMapping("/api/v1/towns/{townId}")
    public ResponseEntity<ApiResponse<TownDetailResponse>> getTown(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townService.getTown(townId)));
    }

    @PostMapping("/api/v1/towns")
    public ResponseEntity<ApiResponse<TownDetailResponse>> createTown(
            @Valid @RequestBody CreateTownRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, townService.createTown(request, actorId)));
    }

    @PatchMapping("/api/v1/towns/{townId}/status")
    public ResponseEntity<ApiResponse<TownDetailResponse>> updateTownStatus(
            @PathVariable UUID townId,
            @Valid @RequestBody UpdateTownStatusRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                townService.updateStatus(townId, request, actorId)));
    }

    @GetMapping("/api/v1/towns/{townId}/config")
    public ResponseEntity<ApiResponse<TownOperationalConfigResponse>> getTownConfig(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townConfigService.getOperationalConfig(townId)));
    }

    @PutMapping("/api/v1/towns/{townId}/config")
    public ResponseEntity<ApiResponse<TownOperationalConfigResponse>> updateTownConfig(
            @PathVariable UUID townId,
            @RequestBody UpdateTownConfigRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                townConfigService.updateOperationalConfig(townId, request)));
    }

    /** Buyer/cart preview: resolved delivery fee for this town + cart value. */
    @GetMapping("/api/v1/towns/{townId}/delivery-fee")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTownDeliveryFeePreview(
            @PathVariable UUID townId,
            @RequestParam(required = false) BigDecimal orderValue,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                townConfigService.resolveDeliveryFee(townId, orderValue)));
    }

    @GetMapping("/api/v1/platform/settings/public")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPublicPlatformSettings(HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, platformSettingsService.getPublicSettings()));
    }

    @GetMapping("/api/v1/platform/settings")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPlatformSettings(HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, platformSettingsService.getSettings()));
    }

    @PatchMapping("/api/v1/platform/settings")
    public ResponseEntity<ApiResponse<Map<String, Object>>> patchPlatformSettings(
            @RequestBody Map<String, Object> patch,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, platformSettingsService.patchSettings(patch)));
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

    /** Resolve delivery fee for a town + order value (DEFAULT platform or SLAB). */
    @GetMapping("/api/v1/internal/towns/{townId}/delivery-fee")
    public ResponseEntity<ApiResponse<Map<String, Object>>> townDeliveryFee(
            @PathVariable UUID townId,
            @RequestParam(required = false) BigDecimal orderValue,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                townConfigService.resolveDeliveryFee(townId, orderValue)));
    }

    /** Platform-wide delivery fee used when town mode is DEFAULT. */
    @GetMapping("/api/v1/internal/platform/delivery-fee")
    public ResponseEntity<ApiResponse<Map<String, Object>>> platformDeliveryFee(HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "deliveryFee", platformSettingsService.resolveDeliveryFee()
        )));
    }
}

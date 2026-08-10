package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.town.dto.request.UpsertTownAdsRequest;
import com.hyperlocalmart.town.dto.response.TownAdsResponse;
import com.hyperlocalmart.town.service.TownAdService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TownAdController {

    private final TownAdService townAdService;

    /** Public buyer feed — enabled ads only. */
    @GetMapping("/api/v1/towns/{townId}/ads")
    public ResponseEntity<ApiResponse<TownAdsResponse>> listPublicAds(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townAdService.listPublicAds(townId)));
    }

    /** Super-admin editor — always returns both slots. */
    @GetMapping("/api/v1/towns/{townId}/ads/editor")
    public ResponseEntity<ApiResponse<TownAdsResponse>> listAdminAds(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townAdService.listAdminAds(townId)));
    }

    @PutMapping("/api/v1/towns/{townId}/ads")
    public ResponseEntity<ApiResponse<TownAdsResponse>> upsertAds(
            @PathVariable UUID townId,
            @Valid @RequestBody UpsertTownAdsRequest request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, townAdService.upsertAds(townId, request, actorId)));
    }
}

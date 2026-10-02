package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.town.dto.response.TownVendorAgentDeliveryConfigResponse;
import com.hyperlocalmart.town.service.TownVendorAgentDeliveryConfigService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TownVendorAgentDeliveryController {

    private final TownVendorAgentDeliveryConfigService configService;

    @GetMapping("/api/v1/platform/towns/{townId}/vendor-agent-delivery-config")
    public ResponseEntity<ApiResponse<TownVendorAgentDeliveryConfigResponse>> getForAdmin(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, configService.get(townId)));
    }

    @PutMapping("/api/v1/platform/towns/{townId}/vendor-agent-delivery-config")
    public ResponseEntity<ApiResponse<TownVendorAgentDeliveryConfigResponse>> replaceForAdmin(
            @PathVariable UUID townId,
            @RequestBody TownVendorAgentDeliveryConfigResponse request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, configService.replace(townId, request, actorId)));
    }

    @GetMapping("/api/v1/internal/towns/{townId}/vendor-agent-delivery-config")
    public ResponseEntity<ApiResponse<TownVendorAgentDeliveryConfigResponse>> getInternal(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, configService.get(townId)));
    }
}

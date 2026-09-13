package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.client.DeliveryClient;
import com.hyperlocalmart.town.dto.request.UpdateTownAgentPayoutRatesRequest;
import com.hyperlocalmart.town.dto.response.TownDeliveryPayoutConfigResponse;
import com.hyperlocalmart.town.service.TownDeliveryPayoutConfigService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TownDeliveryPayoutController {

    private final TownDeliveryPayoutConfigService payoutConfigService;
    private final DeliveryClient deliveryClient;

    @GetMapping("/api/v1/towns/{townId}/delivery-payout-config")
    public ResponseEntity<ApiResponse<TownDeliveryPayoutConfigResponse>> get(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        Viewer viewer = requireViewer(httpRequest, townId);
        TownDeliveryPayoutConfigResponse cfg = payoutConfigService.get(townId);
        applyPermissions(cfg, viewer);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, cfg));
    }

    @PutMapping("/api/v1/towns/{townId}/delivery-payout-config")
    public ResponseEntity<ApiResponse<TownDeliveryPayoutConfigResponse>> replace(
            @PathVariable UUID townId,
            @RequestBody TownDeliveryPayoutConfigResponse request,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        TownDeliveryPayoutConfigResponse cfg = payoutConfigService.replace(townId, request, actorId);
        applyPermissions(cfg, Viewer.SUPER);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, cfg));
    }

    @PatchMapping("/api/v1/towns/{townId}/delivery-payout-config/agent-rates")
    public ResponseEntity<ApiResponse<TownDeliveryPayoutConfigResponse>> patchAgentRates(
            @PathVariable UUID townId,
            @RequestBody UpdateTownAgentPayoutRatesRequest request,
            HttpServletRequest httpRequest) {
        Viewer viewer = requireViewer(httpRequest, townId);
        TownDeliveryPayoutConfigResponse current = payoutConfigService.get(townId);
        boolean allowed = viewer == Viewer.SUPER || current.isTownAdminCanEditAgentRates();
        UUID actorId = AdminAuth.requireUserId(httpRequest);
        TownDeliveryPayoutConfigResponse cfg = payoutConfigService.updateAgentRates(townId, request, allowed, actorId);
        applyPermissions(cfg, viewer);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, cfg));
    }

    @GetMapping("/api/v1/towns/{townId}/delivery-payout-config/estimate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> estimate(
            @PathVariable UUID townId,
            @RequestParam(defaultValue = "0") int completedOrders,
            @RequestParam(defaultValue = "0") int pickups,
            @RequestParam(defaultValue = "0") int lastMiles,
            @RequestParam(defaultValue = "0") int qualifyingDays,
            HttpServletRequest httpRequest) {
        requireViewer(httpRequest, townId);
        TownDeliveryPayoutConfigResponse cfg = payoutConfigService.get(townId);
        TownDeliveryPayoutConfigService.PayoutEstimate estimate = payoutConfigService.estimate(
                cfg, completedOrders, pickups, lastMiles, qualifyingDays);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("agentTotal", estimate.agentTotal());
        body.put("hubTotal", estimate.hubTotal());
        body.put("completedOrders", completedOrders);
        body.put("pickups", pickups);
        body.put("lastMiles", lastMiles);
        body.put("qualifyingDays", qualifyingDays);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, body));
    }

    @GetMapping("/api/v1/internal/towns/{townId}/delivery-payout-config")
    public ResponseEntity<ApiResponse<TownDeliveryPayoutConfigResponse>> internalGet(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, payoutConfigService.get(townId)));
    }

    private Viewer requireViewer(HttpServletRequest request, UUID townId) {
        if (AdminAuth.isSuperAdmin(request)) {
            return Viewer.SUPER;
        }
        if (!AdminAuth.isHubAdmin(request)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin or hub admin role required");
        }
        UUID userId = AdminAuth.requireUserId(request);
        DeliveryClient.HubAdminContext ctx = deliveryClient.getHubAdminContext(userId);
        if (ctx.townId() == null || !ctx.townId().equals(townId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin can only view their own town");
        }
        return Viewer.HUB;
    }

    private static void applyPermissions(TownDeliveryPayoutConfigResponse cfg, Viewer viewer) {
        if (viewer == Viewer.SUPER) {
            cfg.setCanEditStructure(true);
            cfg.setCanEditHubRates(true);
            cfg.setCanEditAgentRates(true);
            return;
        }
        cfg.setCanEditStructure(false);
        cfg.setCanEditHubRates(false);
        cfg.setCanEditAgentRates(cfg.isTownAdminCanEditAgentRates());
    }

    private enum Viewer {
        SUPER,
        HUB
    }
}

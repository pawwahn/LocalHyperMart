package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.request.CreateVendorAgentRequest;
import com.hyperlocalmart.delivery.dto.response.AgentResponse;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.VendorAgentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/delivery/vendor")
@RequiredArgsConstructor
public class VendorDeliveryController {

    private final VendorAgentService vendorAgentService;

    @GetMapping("/agents")
    public ResponseEntity<ApiResponse<List<AgentResponse>>> listAgents(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, vendorAgentService.listAgents(vendorId)));
    }

    @PostMapping("/agents")
    public ResponseEntity<ApiResponse<AgentResponse>> createAgent(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @RequestHeader("X-Shop-Id") UUID shopId,
            @RequestHeader("X-Town-Id") UUID townId,
            @Valid @RequestBody CreateVendorAgentRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorAgentService.createAgent(vendorId, shopId, townId, principal.getUserId(), request)));
    }

    private void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}

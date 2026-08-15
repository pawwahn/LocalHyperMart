package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.VendorOrderAlertResponse;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.VendorOrderAlertService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders/vendor/alerts")
@RequiredArgsConstructor
public class VendorOrderAlertController {

    private final VendorOrderAlertService vendorOrderAlertService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<VendorOrderAlertResponse>>> listPending(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @RequestParam(required = false) String status,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        if (status != null && !status.isBlank() && !"PENDING".equalsIgnoreCase(status.trim())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Only PENDING alerts can be listed");
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorOrderAlertService.listPendingForVendor(vendorId)));
    }

    @PostMapping("/{alertId}/acknowledge")
    public ResponseEntity<ApiResponse<VendorOrderAlertResponse>> acknowledge(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID alertId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorOrderAlertService.acknowledge(vendorId, alertId, principal.getUserId())));
    }

    private void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}

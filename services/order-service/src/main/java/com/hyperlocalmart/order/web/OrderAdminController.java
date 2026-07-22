package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.request.ResolveClaimRequest;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderDetailResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderSummaryResponse;
import com.hyperlocalmart.order.dto.response.ClaimResponse;
import com.hyperlocalmart.order.entity.ClaimStatus;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.OrderAdminService;
import com.hyperlocalmart.order.service.OrderClaimService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders/admin")
@RequiredArgsConstructor
public class OrderAdminController {

    private final OrderAdminService orderAdminService;
    private final OrderClaimService orderClaimService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminOrderSummaryResponse>>> listOrders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderAdminService.listAdminOrders(
                        principal.getUserId(), principal.getRoles(), townId, status, page, size)));
    }

    @GetMapping("/claims")
    public ResponseEntity<ApiResponse<PageResponse<ClaimResponse>>> listClaims(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(required = false) ClaimStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderClaimService.listHubClaims(
                        principal.getUserId(), principal.getRoles(), townId, status, page, size)));
    }

    @PostMapping("/claims/{claimId}/resolve")
    public ResponseEntity<ApiResponse<ClaimResponse>> resolveClaim(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID claimId,
            @RequestParam UUID townId,
            @Valid @RequestBody ResolveClaimRequest request,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderClaimService.resolveClaim(
                        principal.getUserId(), principal.getRoles(), claimId, townId, request)));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<AdminOrderDetailResponse>> getOrder(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderAdminService.getAdminOrder(
                        principal.getUserId(), principal.getRoles(), orderId, townId)));
    }

    private void requireHubOrSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || (!principal.getRoles().contains("HUB_ADMIN")
                && !principal.getRoles().contains("SUPER_ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or super admin role required");
        }
    }
}

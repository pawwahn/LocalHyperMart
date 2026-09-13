package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.request.CreateVendorOrderAlertRequest;
import com.hyperlocalmart.order.dto.request.ResolveClaimRequest;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderDetailResponse;
import com.hyperlocalmart.order.dto.response.AdminOrderResponses.AdminOrderSummaryResponse;
import com.hyperlocalmart.order.dto.response.ClaimResponse;
import com.hyperlocalmart.order.dto.response.PlatformReportResponse;
import com.hyperlocalmart.order.dto.response.ScratchCardGiftReportResponse;
import com.hyperlocalmart.order.dto.response.VendorOrderAlertResponse;
import com.hyperlocalmart.order.entity.ClaimStatus;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.OrderAdminService;
import com.hyperlocalmart.order.service.OrderClaimService;
import com.hyperlocalmart.order.service.PlatformReportService;
import com.hyperlocalmart.order.service.ScratchCardAdminService;
import com.hyperlocalmart.order.service.VendorOrderAlertService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders/admin")
@RequiredArgsConstructor
public class OrderAdminController {

    private final OrderAdminService orderAdminService;
    private final OrderClaimService orderClaimService;
    private final VendorOrderAlertService vendorOrderAlertService;
    private final ScratchCardAdminService scratchCardAdminService;
    private final PlatformReportService platformReportService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminOrderSummaryResponse>>> listOrders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) UUID townId,
            @RequestParam(required = false) UUID buyerId,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderAdminService.listAdminOrders(
                        principal.getUserId(), principal.getRoles(), townId, buyerId, status, q, page, size)));
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

    @PostMapping("/sub-orders/{subOrderId}/alerts")
    public ResponseEntity<ApiResponse<VendorOrderAlertResponse>> createVendorAlert(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID subOrderId,
            @RequestParam UUID townId,
            @RequestBody(required = false) @Valid CreateVendorOrderAlertRequest request,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        CreateVendorOrderAlertRequest body = request == null ? new CreateVendorOrderAlertRequest() : request;
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorOrderAlertService.createAlert(
                        principal.getUserId(), principal.getRoles(), subOrderId, townId, body)));
    }

    @GetMapping("/reports/platform")
    public ResponseEntity<ApiResponse<PlatformReportResponse>> platformReport(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) UUID townId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, platformReportService.getReport(townId, from, to)));
    }

    @GetMapping("/scratch-cards/report")
    public ResponseEntity<ApiResponse<ScratchCardGiftReportResponse>> scratchCardGiftReport(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) UUID townId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                scratchCardAdminService.townGiftReport(townId, from, to)));
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

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}

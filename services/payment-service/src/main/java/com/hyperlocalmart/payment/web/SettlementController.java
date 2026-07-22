package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.CreateSettlementRequest;
import com.hyperlocalmart.payment.dto.request.MarkSettlementPaidRequest;
import com.hyperlocalmart.payment.dto.request.VendorPayoutLookupRequest;
import com.hyperlocalmart.payment.dto.response.SettlementCandidateView;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.dto.response.VendorOrderPayoutResponse;
import com.hyperlocalmart.payment.dto.response.VendorSettlementAdjustmentResponse;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.SettlementService;
import com.hyperlocalmart.payment.service.VendorSettlementAdjustmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/settlements")
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;
    private final VendorSettlementAdjustmentService vendorSettlementAdjustmentService;

    @GetMapping("/candidates")
    public ResponseEntity<ApiResponse<SettlementCandidateView>> candidates(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam UUID vendorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.listCandidates(townId, vendorId, from, to)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SettlementResponse>> create(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateSettlementRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                settlementService.create(principal.getUserId(), request)));
    }

    @PostMapping("/{settlementId}/mark-paid")
    public ResponseEntity<ApiResponse<SettlementResponse>> markPaid(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody MarkSettlementPaidRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.markPaid(principal.getUserId(), settlementId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<SettlementResponse>>>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) UUID townId,
            @RequestParam(required = false) SettlementPayeeType payeeType,
            @RequestParam(required = false) UUID payeeId,
            @RequestParam(required = false) SettlementStatus status,
            @RequestHeader(value = "X-Vendor-Id", required = false) UUID vendorIdHeader,
            HttpServletRequest httpRequest) {
        if (isSuperAdmin(principal)) {
            return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                    "items", settlementService.list(townId, payeeType, payeeId, status))));
        }
        requireVendor(principal);
        if (vendorIdHeader == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "X-Vendor-Id header required");
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", settlementService.list(
                        townId,
                        SettlementPayeeType.VENDOR,
                        vendorIdHeader,
                        status))));
    }

    @GetMapping("/{settlementId}")
    public ResponseEntity<ApiResponse<SettlementResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @RequestHeader(value = "X-Vendor-Id", required = false) UUID vendorIdHeader,
            HttpServletRequest httpRequest) {
        if (isSuperAdmin(principal)) {
            return ResponseEntity.ok(ApiResponses.ok(httpRequest, settlementService.get(settlementId)));
        }
        requireVendor(principal);
        if (vendorIdHeader == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "X-Vendor-Id header required");
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.getForVendor(vendorIdHeader, settlementId)));
    }

    @PostMapping("/vendor/me/lookup")
    public ResponseEntity<ApiResponse<VendorOrderPayoutResponse>> lookupVendorPayouts(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody VendorPayoutLookupRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementService.lookupVendorPayouts(vendorId, request.getSubOrderIds())));
    }

    /** Pending + applied claim chargebacks that reduce this vendor's payouts. */
    @GetMapping("/vendor/me/adjustments")
    public ResponseEntity<ApiResponse<Map<String, List<VendorSettlementAdjustmentResponse>>>> listMyAdjustments(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", vendorSettlementAdjustmentService.listForVendor(vendorId))));
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (!isSuperAdmin(principal)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }

    private void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }

    private boolean isSuperAdmin(AuthUserPrincipal principal) {
        return principal != null && principal.getRoles().contains("SUPER_ADMIN");
    }
}

package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.ConfirmCodHandoverRequest;
import com.hyperlocalmart.payment.dto.request.DeclareCodHandoverRequest;
import com.hyperlocalmart.payment.dto.response.CodAgentHandoverResponse;
import com.hyperlocalmart.payment.dto.response.CodAgentHandoverSummaryResponse;
import com.hyperlocalmart.payment.dto.response.CodCloseDayResponse;
import com.hyperlocalmart.payment.dto.response.CodCustodianOutstandingResponse;
import com.hyperlocalmart.payment.dto.response.CodCustodianPendingDetailResponse;
import com.hyperlocalmart.payment.dto.response.CodCustodianReceivableResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.CodAgentHandoverService;
import com.hyperlocalmart.payment.service.CodCloseDayService;
import com.hyperlocalmart.payment.service.CodCustodianReceivableService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CodAgentHandoverController {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final CodAgentHandoverService handoverService;
    private final CodCloseDayService codCloseDayService;
    private final CodCustodianReceivableService custodianReceivableService;

    @GetMapping("/api/v1/payments/agents/me/cod-handover/summary")
    public ResponseEntity<ApiResponse<CodAgentHandoverSummaryResponse>> agentSummary(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                handoverService.agentSummary(principal.getUserId())));
    }

    @PostMapping("/api/v1/payments/agents/me/cod-handover/declare")
    public ResponseEntity<ApiResponse<CodAgentHandoverResponse>> declare(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody DeclareCodHandoverRequest request,
            HttpServletRequest httpRequest) {
        requireAgent(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                handoverService.declare(principal.getUserId(), request)));
    }

    @GetMapping("/api/v1/payments/cod/custodian/receivables/pending-detail")
    public ResponseEntity<ApiResponse<CodCustodianPendingDetailResponse>> custodianPendingDetail(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(required = false) UUID hubId,
            @RequestParam(required = false) UUID vendorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireHubVendorOrSuper(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                custodianReceivableService.pendingDetail(townId, hubId, vendorId, from, to)));
    }

    @GetMapping("/api/v1/payments/cod/custodian/receivables/outstanding")
    public ResponseEntity<ApiResponse<CodCustodianOutstandingResponse>> custodianOutstanding(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(required = false) UUID hubId,
            @RequestParam(required = false) UUID vendorId,
            HttpServletRequest httpRequest) {
        requireHubVendorOrSuper(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                custodianReceivableService.outstanding(townId, hubId, vendorId)));
    }

    @GetMapping("/api/v1/payments/cod/custodian/receivables")
    public ResponseEntity<ApiResponse<CodCustodianReceivableResponse>> custodianReceivables(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) UUID hubId,
            @RequestParam(required = false) UUID vendorId,
            HttpServletRequest httpRequest) {
        requireHubVendorOrSuper(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                custodianReceivableService.receivables(townId, date, hubId, vendorId)));
    }

    @GetMapping("/api/v1/payments/cod/handovers/pending")
    public ResponseEntity<ApiResponse<List<CodAgentHandoverResponse>>> pendingHandovers(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(required = false) UUID hubId,
            @RequestParam(required = false) UUID vendorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest httpRequest) {
        requireHubVendorOrSuper(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                handoverService.listPendingForCustodian(
                        principal.getUserId(), townId, hubId, vendorId, date, isSuperAdmin(principal))));
    }

    @PostMapping("/api/v1/payments/cod/handovers/confirm")
    public ResponseEntity<ApiResponse<CodCloseDayResponse>> confirmHandover(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody ConfirmCodHandoverRequest request,
            HttpServletRequest httpRequest) {
        requireHubVendorOrSuper(principal);
        var closeDay = handoverService.confirm(principal.getUserId(), request, isSuperAdmin(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                codCloseDayService.toResponse(closeDay)));
    }

    @GetMapping("/api/v1/payments/cod/oversight")
    public ResponseEntity<ApiResponse<List<CodAgentHandoverResponse>>> oversight(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, handoverService.oversight(townId, from, to)));
    }

    private static void requireAgent(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("DELIVERY_AGENT")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Delivery agent role required");
        }
    }

    private static void requireHubVendorOrSuper(AuthUserPrincipal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Authentication required");
        }
        if (isSuperAdmin(principal) || principal.getRoles().contains("HUB_ADMIN")
                || principal.getRoles().contains("VENDOR")) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin, vendor, or super admin required");
    }

    private static void requireSuperAdmin(AuthUserPrincipal principal) {
        if (!isSuperAdmin(principal)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin required");
        }
    }

    private static boolean isSuperAdmin(AuthUserPrincipal principal) {
        return principal != null && principal.getRoles().contains("SUPER_ADMIN");
    }
}

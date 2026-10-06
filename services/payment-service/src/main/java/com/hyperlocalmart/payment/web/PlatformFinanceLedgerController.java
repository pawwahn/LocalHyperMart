package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.CreateRazorpaySettlementBatchRequest;
import com.hyperlocalmart.payment.dto.response.PlatformFinanceComplianceResponse;
import com.hyperlocalmart.payment.dto.response.PlatformFinanceLedgerResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.PlatformFinanceComplianceService;
import com.hyperlocalmart.payment.service.PlatformFinanceLedgerService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/admin/finance-ledger")
@RequiredArgsConstructor
public class PlatformFinanceLedgerController {

    private final PlatformFinanceLedgerService platformFinanceLedgerService;
    private final PlatformFinanceComplianceService platformFinanceComplianceService;

    @GetMapping
    public ResponseEntity<ApiResponse<PlatformFinanceLedgerResponse>> getLedger(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID townId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                platformFinanceLedgerService.ledger(townId, from, to)));
    }

    @GetMapping("/compliance-pack")
    public ResponseEntity<ApiResponse<PlatformFinanceComplianceResponse>> compliancePack(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID townId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                platformFinanceComplianceService.compliancePack(townId, from, to)));
    }

    @PostMapping("/gateway-settlements")
    public ResponseEntity<ApiResponse<PlatformFinanceComplianceResponse.RazorpayBatchRow>> recordGatewaySettlement(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateRazorpaySettlementBatchRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                platformFinanceComplianceService.recordRazorpayBatch(principal.getUserId(), request)));
    }

    private static void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}

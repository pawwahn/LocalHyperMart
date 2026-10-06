package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.CreateCodHubPlatformRemittanceRequest;
import com.hyperlocalmart.payment.dto.response.CodHubLedgerResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.CodHubLedgerService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/cod/hub")
@RequiredArgsConstructor
public class CodHubLedgerController {

    private final CodHubLedgerService codHubLedgerService;

    @GetMapping("/ledger")
    public ResponseEntity<ApiResponse<CodHubLedgerResponse>> ledger(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam UUID hubId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                codHubLedgerService.ledger(
                        townId, hubId, from, to, principal.getUserId(), isSuperAdmin(principal))));
    }

    @PostMapping("/remittances")
    public ResponseEntity<ApiResponse<CodHubLedgerResponse.RemittanceRow>> recordRemittance(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateCodHubPlatformRemittanceRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                codHubLedgerService.recordRemittance(request, principal.getUserId())));
    }

    private static void requireHubOrSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null
                || (!principal.getRoles().contains("HUB_ADMIN")
                && !principal.getRoles().contains("SUPER_ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or super admin role required");
        }
    }

    private static void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }

    private static boolean isSuperAdmin(AuthUserPrincipal principal) {
        return principal != null && principal.getRoles().contains("SUPER_ADMIN");
    }
}

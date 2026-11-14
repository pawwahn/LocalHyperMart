package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.common.security.PlatformAdminRoles;
import com.hyperlocalmart.payment.dto.request.CreateCodHubPlatformRemittanceRequest;
import com.hyperlocalmart.payment.dto.response.CodHubLedgerResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.security.PlatformAdminPrincipalAuth;
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
        requireHubOrPlatformStaff(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                codHubLedgerService.ledger(
                        townId, hubId, from, to, principal.getUserId(), isPlatformStaff(principal))));
    }

    @PostMapping("/remittances")
    public ResponseEntity<ApiResponse<CodHubLedgerResponse.RemittanceRow>> recordRemittance(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateCodHubPlatformRemittanceRequest request,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireMoveMoney(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                codHubLedgerService.recordRemittance(request, principal.getUserId())));
    }

    private static void requireHubOrPlatformStaff(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or app admin role required");
        }
        if (principal.getRoles().contains("HUB_ADMIN")
                || PlatformAdminRoles.isPlatformStaff(principal.getRoles())) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or app admin role required");
    }

    private static boolean isPlatformStaff(AuthUserPrincipal principal) {
        return PlatformAdminPrincipalAuth.isPlatformStaff(principal);
    }
}

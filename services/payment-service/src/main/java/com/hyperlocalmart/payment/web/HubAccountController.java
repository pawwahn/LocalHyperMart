package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.ReportNotReceivedRequest;
import com.hyperlocalmart.payment.dto.response.HubAccountSummaryResponse;
import com.hyperlocalmart.payment.dto.response.SettlementResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.HubAccountSummaryService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/hub/me")
@RequiredArgsConstructor
public class HubAccountController {

    private final HubAccountSummaryService hubAccountSummaryService;

    @GetMapping("/account-summary")
    public ResponseEntity<ApiResponse<HubAccountSummaryResponse>> accountSummary(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                hubAccountSummaryService.summary(principal.getUserId(), from, to)));
    }

    /** Payout statement KoyaKart sent this hub, including the trip lines on the bill. */
    @GetMapping("/payouts/{settlementId}")
    public ResponseEntity<ApiResponse<SettlementResponse>> payout(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                hubAccountSummaryService.payout(principal.getUserId(), settlementId)));
    }

    /** Hub confirms the payout reached them. */
    @PostMapping("/payouts/{settlementId}/acknowledge")
    public ResponseEntity<ApiResponse<SettlementResponse>> acknowledge(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                hubAccountSummaryService.acknowledgePayout(principal.getUserId(), settlementId)));
    }

    /** Hub says the payout has not reached them. */
    @PostMapping("/payouts/{settlementId}/not-received")
    public ResponseEntity<ApiResponse<SettlementResponse>> notReceived(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID settlementId,
            @Valid @RequestBody(required = false) ReportNotReceivedRequest request,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        String note = request == null ? null : request.getNote();
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                hubAccountSummaryService.reportPayoutNotReceived(principal.getUserId(), settlementId, note)));
    }

    private static void requireHubAdmin(AuthUserPrincipal principal) {
        if (principal == null
                || principal.getRoles() == null
                || (!principal.getRoles().contains("HUB_ADMIN")
                && !principal.getRoles().contains("SUPER_ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
        }
    }
}

package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.ReviewHubPlatformPaymentRequest;
import com.hyperlocalmart.payment.dto.request.SubmitHubPlatformPaymentRequest;
import com.hyperlocalmart.payment.dto.request.UpdateHubPlatformPaymentRequest;
import com.hyperlocalmart.payment.dto.response.HubPlatformPaymentPayableResponse;
import com.hyperlocalmart.payment.dto.response.HubPlatformPaymentReceiptResponse;
import com.hyperlocalmart.payment.dto.response.HubPlatformPaymentSubmissionResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.HubPlatformPaymentSubmissionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class HubPlatformPaymentController {

    private final HubPlatformPaymentSubmissionService submissionService;

    @GetMapping("/api/v1/payments/hub/me/payment-payable")
    public ResponseEntity<ApiResponse<HubPlatformPaymentPayableResponse>> hubPayable(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, submissionService.payable(principal.getUserId())));
    }

    @GetMapping("/api/v1/payments/hub/me/payment-submissions")
    public ResponseEntity<ApiResponse<List<HubPlatformPaymentSubmissionResponse>>> hubList(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, submissionService.listForHub(principal.getUserId())));
    }

    @GetMapping("/api/v1/payments/hub/me/payment-submissions/{submissionId}/receipt")
    public ResponseEntity<ApiResponse<HubPlatformPaymentReceiptResponse>> hubReceipt(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID submissionId,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                submissionService.receiptForHub(principal.getUserId(), submissionId)));
    }

    @PostMapping("/api/v1/payments/hub/me/payment-submissions")
    public ResponseEntity<ApiResponse<HubPlatformPaymentSubmissionResponse>> hubSubmit(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody SubmitHubPlatformPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                submissionService.submit(principal.getUserId(), request)));
    }

    @PatchMapping("/api/v1/payments/hub/me/payment-submissions/{submissionId}")
    public ResponseEntity<ApiResponse<HubPlatformPaymentSubmissionResponse>> hubUpdatePending(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID submissionId,
            @Valid @RequestBody UpdateHubPlatformPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                submissionService.updatePending(principal.getUserId(), submissionId, request)));
    }

    @GetMapping("/api/v1/payments/hub/payment-submissions")
    public ResponseEntity<ApiResponse<List<HubPlatformPaymentSubmissionResponse>>> adminList(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(required = false) UUID hubId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, submissionService.listForAdmin(townId, hubId, principal.getUserId())));
    }

    @PostMapping("/api/v1/payments/hub/payment-submissions/{submissionId}/verify")
    public ResponseEntity<ApiResponse<HubPlatformPaymentSubmissionResponse>> verify(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID submissionId,
            @RequestBody(required = false) ReviewHubPlatformPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                submissionService.verify(submissionId, principal.getUserId(), request)));
    }

    @PostMapping("/api/v1/payments/hub/payment-submissions/{submissionId}/reject")
    public ResponseEntity<ApiResponse<HubPlatformPaymentSubmissionResponse>> reject(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID submissionId,
            @Valid @RequestBody ReviewHubPlatformPaymentRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                submissionService.reject(submissionId, principal.getUserId(), request)));
    }

    private static void requireHubAdmin(AuthUserPrincipal principal) {
        if (principal == null
                || principal.getRoles() == null
                || (!principal.getRoles().contains("HUB_ADMIN")
                && !principal.getRoles().contains("SUPER_ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
        }
    }

    private static void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}

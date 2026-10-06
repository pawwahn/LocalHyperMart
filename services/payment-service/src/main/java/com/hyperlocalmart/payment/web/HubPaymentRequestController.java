package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.CreateHubCodPaymentRequest;
import com.hyperlocalmart.payment.dto.request.CreateHubFranchisePaymentRequest;
import com.hyperlocalmart.payment.dto.request.PreviewHubCodForMeRequest;
import com.hyperlocalmart.payment.dto.request.SubmitHubPaymentForRequest;
import com.hyperlocalmart.payment.dto.response.HubCodPaymentPreviewResponse;
import com.hyperlocalmart.payment.dto.response.HubFranchiseDuePreviewResponse;
import com.hyperlocalmart.payment.dto.response.HubPaymentRequestResponse;
import com.hyperlocalmart.payment.dto.response.HubPlatformPaymentSubmissionResponse;
import com.hyperlocalmart.payment.entity.HubPaymentRequestType;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.HubPaymentRequestService;
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
public class HubPaymentRequestController {

    private final HubPaymentRequestService requestService;

    @GetMapping("/api/v1/payments/hub/me/payment-requests")
    public ResponseEntity<ApiResponse<List<HubPaymentRequestResponse>>> hubList(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) String type,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        HubPaymentRequestType parsed = parseTypeOptional(type);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, requestService.listForHub(principal.getUserId(), parsed)));
    }

    @GetMapping("/api/v1/payments/hub/me/payment-requests/{requestId}")
    public ResponseEntity<ApiResponse<HubPaymentRequestResponse>> hubGet(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID requestId,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, requestService.getForHub(principal.getUserId(), requestId)));
    }

    @PostMapping("/api/v1/payments/hub/me/payment-requests/cod/preview")
    public ResponseEntity<ApiResponse<HubCodPaymentPreviewResponse>> hubPreviewCod(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody PreviewHubCodForMeRequest body,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, requestService.previewCodForHub(principal.getUserId(), body)));
    }

    @GetMapping("/api/v1/payments/hub/me/franchise-due")
    public ResponseEntity<ApiResponse<HubFranchiseDuePreviewResponse>> hubFranchiseDue(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam int year,
            @RequestParam int month,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                requestService.previewFranchiseForHub(principal.getUserId(), year, month)));
    }

    @PostMapping("/api/v1/payments/hub/me/payment-requests/{requestId}/submit")
    public ResponseEntity<ApiResponse<HubPlatformPaymentSubmissionResponse>> hubSubmit(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID requestId,
            @Valid @RequestBody SubmitHubPaymentForRequest body,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                requestService.submitForRequest(principal.getUserId(), requestId, body)));
    }

    @GetMapping("/api/v1/payments/hub/payment-requests")
    public ResponseEntity<ApiResponse<List<HubPaymentRequestResponse>>> adminList(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(required = false) UUID hubId,
            @RequestParam(required = false) String type,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                requestService.listForAdmin(townId, hubId, type, principal.getUserId())));
    }

    @PostMapping("/api/v1/payments/hub/payment-requests/cod/preview")
    public ResponseEntity<ApiResponse<HubCodPaymentPreviewResponse>> previewCod(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateHubCodPaymentRequest body,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                requestService.previewCod(body, principal.getUserId(), page, size)));
    }

    @GetMapping("/api/v1/payments/hub/payment-requests/{requestId}/lines")
    public ResponseEntity<ApiResponse<PageResponse<HubPaymentRequestResponse.CodLine>>> adminLines(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID requestId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, requestService.listLines(requestId, page, size)));
    }

    @PostMapping("/api/v1/payments/hub/payment-requests/cod")
    public ResponseEntity<ApiResponse<HubPaymentRequestResponse>> createCod(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateHubCodPaymentRequest body,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                requestService.createCod(body, principal.getUserId())));
    }

    @PostMapping("/api/v1/payments/hub/payment-requests/franchise")
    public ResponseEntity<ApiResponse<HubPaymentRequestResponse>> createFranchise(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateHubFranchisePaymentRequest body,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                requestService.createFranchise(body, principal.getUserId())));
    }

    @PostMapping("/api/v1/payments/hub/payment-requests/{requestId}/cancel")
    public ResponseEntity<ApiResponse<HubPaymentRequestResponse>> cancel(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID requestId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, requestService.cancel(requestId, principal.getUserId())));
    }

    private static HubPaymentRequestType parseTypeOptional(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return HubPaymentRequestType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "type must be COD or FRANCHISE");
        }
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

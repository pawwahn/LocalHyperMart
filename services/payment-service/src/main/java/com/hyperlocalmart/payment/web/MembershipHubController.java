package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.ConfirmMembershipCashRequest;
import com.hyperlocalmart.payment.dto.response.MembershipPurchaseResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.MembershipService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/hub/memberships")
@RequiredArgsConstructor
public class MembershipHubController {

    private final MembershipService membershipService;

    @GetMapping("/pending-cash")
    public ResponseEntity<ApiResponse<List<MembershipPurchaseResponse>>> pendingCash(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireHubOrSuper(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.listPendingCash()));
    }

    @PostMapping("/cash/confirm")
    public ResponseEntity<ApiResponse<MembershipPurchaseResponse>> confirmCash(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestBody ConfirmMembershipCashRequest request,
            HttpServletRequest httpRequest) {
        requireHubOrSuper(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                membershipService.confirmCash(principal.getUserId(), principal.getPhone(), request)));
    }

    @PostMapping("/cash/{purchaseId}/cancel")
    public ResponseEntity<ApiResponse<MembershipPurchaseResponse>> cancelCash(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID purchaseId,
            HttpServletRequest httpRequest) {
        requireHubOrSuper(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                membershipService.cancelCashRequest(principal.getUserId(), purchaseId)));
    }

    private static void requireHubOrSuper(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
        }
        if (principal.getRoles().contains("HUB_ADMIN") || principal.getRoles().contains("SUPER_ADMIN")) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
    }
}

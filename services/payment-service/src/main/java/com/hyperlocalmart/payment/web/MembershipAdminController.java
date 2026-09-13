package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.ConfirmMembershipCashRequest;
import com.hyperlocalmart.payment.dto.request.GiftMembershipRequest;
import com.hyperlocalmart.payment.dto.response.MembershipMemberRow;
import com.hyperlocalmart.payment.dto.response.MembershipPurchaseResponse;
import com.hyperlocalmart.payment.dto.response.MembershipReportResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.MembershipService;
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
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/admin/memberships")
@RequiredArgsConstructor
public class MembershipAdminController {

    private final MembershipService membershipService;

    @GetMapping("/report")
    public ResponseEntity<ApiResponse<MembershipReportResponse>> report(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.report(from, to)));
    }

    @GetMapping("/members")
    public ResponseEntity<ApiResponse<List<MembershipMemberRow>>> members(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.listMembers()));
    }

    @GetMapping("/purchases")
    public ResponseEntity<ApiResponse<List<MembershipPurchaseResponse>>> purchases(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.listPurchases()));
    }

    @GetMapping("/pending-cash")
    public ResponseEntity<ApiResponse<List<MembershipPurchaseResponse>>> pendingCash(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.listPendingCash()));
    }

    @PostMapping("/gift")
    public ResponseEntity<ApiResponse<MembershipPurchaseResponse>> gift(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody GiftMembershipRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.gift(principal.getUserId(), request)));
    }

    @PostMapping("/cash/confirm")
    public ResponseEntity<ApiResponse<MembershipPurchaseResponse>> confirmCash(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestBody ConfirmMembershipCashRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                membershipService.confirmCash(principal.getUserId(), request)));
    }

    @PostMapping("/cash/{purchaseId}/cancel")
    public ResponseEntity<ApiResponse<MembershipPurchaseResponse>> cancelCash(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID purchaseId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                membershipService.cancelCashRequest(principal.getUserId(), purchaseId)));
    }

    private static void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}

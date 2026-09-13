package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.dto.request.PurchaseMembershipRequest;
import com.hyperlocalmart.payment.dto.response.MembershipCatalogResponse;
import com.hyperlocalmart.payment.dto.response.MembershipMeResponse;
import com.hyperlocalmart.payment.dto.response.MembershipPurchaseResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.MembershipService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/memberships")
@RequiredArgsConstructor
public class MembershipController {

    private final MembershipService membershipService;

    @GetMapping("/catalog")
    public ResponseEntity<ApiResponse<MembershipCatalogResponse>> catalog(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                membershipService.catalog(principal.getUserId(), principal.getPhone(), townId)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<MembershipMeResponse>> me(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.mine(principal.getUserId())));
    }

    @PostMapping("/purchase")
    public ResponseEntity<ApiResponse<MembershipPurchaseResponse>> purchase(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody PurchaseMembershipRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                membershipService.purchase(principal.getUserId(), principal.getPhone(), request)));
    }
}

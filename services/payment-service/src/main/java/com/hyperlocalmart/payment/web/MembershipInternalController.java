package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.dto.request.ConsumeMembershipRequest;
import com.hyperlocalmart.payment.dto.request.ReserveBundledMembershipRequest;
import com.hyperlocalmart.payment.dto.request.RestoreMembershipRequest;
import com.hyperlocalmart.payment.dto.response.ConsumeMembershipResponse;
import com.hyperlocalmart.payment.dto.response.MembershipMeResponse;
import com.hyperlocalmart.payment.service.MembershipService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/memberships")
@RequiredArgsConstructor
public class MembershipInternalController {

    private final MembershipService membershipService;

    @GetMapping("/{buyerId}")
    public ResponseEntity<ApiResponse<MembershipMeResponse>> mine(
            @PathVariable UUID buyerId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.mine(buyerId)));
    }

    @PostMapping("/consume")
    public ResponseEntity<ApiResponse<ConsumeMembershipResponse>> consume(
            @Valid @RequestBody ConsumeMembershipRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, membershipService.consume(request)));
    }

    @PostMapping("/restore")
    public ResponseEntity<ApiResponse<Void>> restore(
            @Valid @RequestBody RestoreMembershipRequest request,
            HttpServletRequest httpRequest) {
        membershipService.restore(request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }

    @PostMapping("/bundle/reserve")
    public ResponseEntity<ApiResponse<java.util.UUID>> reserveBundled(
            @Valid @RequestBody ReserveBundledMembershipRequest request,
            HttpServletRequest httpRequest) {
        UUID id = membershipService.reserveBundledWithOrder(request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, id));
    }

    @PostMapping("/bundle/complete/{orderId}")
    public ResponseEntity<ApiResponse<Void>> completeBundled(
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        membershipService.completeBundledForOrder(orderId, null);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }

    @PostMapping("/bundle/cancel/{orderId}")
    public ResponseEntity<ApiResponse<Void>> cancelBundled(
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        membershipService.cancelBundledForOrder(orderId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }
}

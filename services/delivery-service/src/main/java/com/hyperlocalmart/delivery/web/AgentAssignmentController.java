package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.request.BuyerRejectedRequest;
import com.hyperlocalmart.delivery.dto.request.DeliverRequest;
import com.hyperlocalmart.delivery.dto.request.PickedFromVendorRequest;
import com.hyperlocalmart.delivery.dto.response.AgentMeResponse;
import com.hyperlocalmart.delivery.dto.response.AgentStatsResponse;
import com.hyperlocalmart.delivery.dto.response.AssignmentResponse;
import com.hyperlocalmart.delivery.dto.response.DeliveryManifestResponse;
import com.hyperlocalmart.delivery.dto.response.PickupManifestResponse;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.AgentService;
import com.hyperlocalmart.delivery.service.AgentStatsService;
import com.hyperlocalmart.delivery.service.AssignmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AgentAssignmentController {

    private final AssignmentService assignmentService;
    private final AgentStatsService agentStatsService;
    private final AgentService agentService;

    @GetMapping("/api/v1/delivery/agents/me")
    public ResponseEntity<ApiResponse<AgentMeResponse>> me(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                agentService.getMyAgent(principal.getUserId())));
    }

    @GetMapping("/api/v1/delivery/agents/me/stats")
    public ResponseEntity<ApiResponse<AgentStatsResponse>> myStats(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                agentStatsService.getMyStats(principal.getUserId())));
    }

    @GetMapping("/api/v1/delivery/agents/me/assignments")
    public ResponseEntity<ApiResponse<PageResponse<AssignmentResponse>>> listMyAssignments(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(defaultValue = "active") String scope,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.listAgentAssignmentsPaged(principal.getUserId(), scope, page, size)));
    }

    @GetMapping("/api/v1/delivery/agents/me/assignments/{id}/pickup-manifest")
    public ResponseEntity<ApiResponse<PickupManifestResponse>> pickupManifest(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable("id") UUID assignmentId,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.getPickupManifest(principal.getUserId(), assignmentId)));
    }

    @GetMapping("/api/v1/delivery/agents/me/assignments/{id}/delivery-manifest")
    public ResponseEntity<ApiResponse<DeliveryManifestResponse>> deliveryManifest(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable("id") UUID assignmentId,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.getDeliveryManifest(principal.getUserId(), assignmentId)));
    }

    @PostMapping("/api/v1/delivery/assignments/{id}/picked-from-vendor")
    public ResponseEntity<ApiResponse<AssignmentResponse>> markPickedFromVendor(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable("id") UUID assignmentId,
            @RequestBody(required = false) PickedFromVendorRequest request,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.markPickedFromVendor(principal.getUserId(), assignmentId, request)));
    }

    @PostMapping("/api/v1/delivery/assignments/{id}/picked-from-hub")
    public ResponseEntity<ApiResponse<AssignmentResponse>> markPickedFromHub(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable("id") UUID assignmentId,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.markPickedFromHub(principal.getUserId(), assignmentId)));
    }

    @PostMapping("/api/v1/delivery/assignments/{id}/deliver")
    public ResponseEntity<ApiResponse<AssignmentResponse>> deliver(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable("id") UUID assignmentId,
            @Valid @RequestBody DeliverRequest request,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.deliver(principal.getUserId(), assignmentId, request)));
    }

    @PostMapping("/api/v1/delivery/assignments/{id}/buyer-rejected")
    public ResponseEntity<ApiResponse<AssignmentResponse>> buyerRejected(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable("id") UUID assignmentId,
            @Valid @RequestBody BuyerRejectedRequest request,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.buyerRejected(principal.getUserId(), assignmentId, request)));
    }

    private void requireDeliveryAgent(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("DELIVERY_AGENT")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Delivery agent role required");
        }
    }
}

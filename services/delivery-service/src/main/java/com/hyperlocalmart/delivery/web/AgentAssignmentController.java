package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.request.BuyerRejectedRequest;
import com.hyperlocalmart.delivery.dto.request.DeliverRequest;
import com.hyperlocalmart.delivery.dto.request.PickedFromVendorRequest;
import com.hyperlocalmart.delivery.dto.response.AssignmentResponse;
import com.hyperlocalmart.delivery.entity.AssignmentStatus;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.AssignmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AgentAssignmentController {

    private final AssignmentService assignmentService;

    @GetMapping("/api/v1/delivery/agents/me/assignments")
    public ResponseEntity<ApiResponse<List<AssignmentResponse>>> listMyAssignments(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) AssignmentStatus status,
            HttpServletRequest httpRequest) {
        requireDeliveryAgent(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.listAgentAssignments(principal.getUserId(), status)));
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

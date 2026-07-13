package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.request.AssignLastMileRequest;
import com.hyperlocalmart.delivery.dto.request.AssignPickupRequest;
import com.hyperlocalmart.delivery.dto.request.ReassignAssignmentRequest;
import com.hyperlocalmart.delivery.dto.response.AssignmentResponse;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.AssignmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/delivery/assignments")
@RequiredArgsConstructor
public class AssignmentController {

    private final AssignmentService assignmentService;

    @PostMapping("/pickup")
    public ResponseEntity<ApiResponse<AssignmentResponse>> assignPickup(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody AssignPickupRequest request,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        AssignmentResponse response = assignmentService.assignPickup(principal.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }

    @PostMapping("/last-mile")
    public ResponseEntity<ApiResponse<AssignmentResponse>> assignLastMile(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody AssignLastMileRequest request,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        AssignmentResponse response = assignmentService.assignLastMile(principal.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }

    @PostMapping("/sub-orders/{vendorSubOrderId}/at-hub")
    public ResponseEntity<ApiResponse<AssignmentResponse>> markAtHub(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorSubOrderId,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.markAtHub(principal.getUserId(), vendorSubOrderId)));
    }

    @PatchMapping("/{assignmentId}/reassign")
    public ResponseEntity<ApiResponse<AssignmentResponse>> reassign(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID assignmentId,
            @Valid @RequestBody ReassignAssignmentRequest request,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.reassign(principal.getUserId(), assignmentId, request)));
    }

    private void requireHubAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("HUB_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
        }
    }
}

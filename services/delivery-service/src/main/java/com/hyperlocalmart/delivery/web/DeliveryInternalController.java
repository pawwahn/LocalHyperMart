package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.delivery.dto.request.VerifyHubPinRequest;
import com.hyperlocalmart.delivery.dto.response.HubAdminContextResponse;
import com.hyperlocalmart.delivery.dto.response.HubContactResponse;
import com.hyperlocalmart.delivery.dto.response.OrderAssignmentResponse;
import com.hyperlocalmart.delivery.dto.response.VerifyHubPinResponse;
import com.hyperlocalmart.delivery.service.AgentService;
import com.hyperlocalmart.delivery.service.HubPinService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class DeliveryInternalController {

    private final AgentService agentService;
    private final HubPinService hubPinService;

    @GetMapping("/api/v1/internal/hub-admins/{userId}/context")
    public ResponseEntity<ApiResponse<HubAdminContextResponse>> getHubAdminContext(
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.getHubAdminContext(userId)));
    }

    @PostMapping("/api/v1/internal/hub-admins/{userId}/verify-pin")
    public ResponseEntity<ApiResponse<VerifyHubPinResponse>> verifyHubPin(
            @PathVariable UUID userId,
            @Valid @RequestBody VerifyHubPinRequest request,
            HttpServletRequest httpRequest) {
        hubPinService.verifyPin(userId, request.getPin());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                VerifyHubPinResponse.builder().valid(true).build()));
    }

    @GetMapping("/api/v1/internal/towns/{townId}/hub-contacts")
    public ResponseEntity<ApiResponse<List<HubContactResponse>>> listHubContacts(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.listHubContactsForTown(townId)));
    }

    @GetMapping("/api/v1/internal/orders/{orderId}/assignments")
    public ResponseEntity<ApiResponse<List<OrderAssignmentResponse>>> getOrderAssignments(
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.getAssignmentsForOrder(orderId)));
    }
}

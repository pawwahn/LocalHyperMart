package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.delivery.dto.response.HubAdminContextResponse;
import com.hyperlocalmart.delivery.dto.response.OrderAssignmentResponse;
import com.hyperlocalmart.delivery.service.AgentService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class DeliveryInternalController {

    private final AgentService agentService;

    @GetMapping("/api/v1/internal/hub-admins/{userId}/context")
    public ResponseEntity<ApiResponse<HubAdminContextResponse>> getHubAdminContext(
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.getHubAdminContext(userId)));
    }

    @GetMapping("/api/v1/internal/orders/{orderId}/assignments")
    public ResponseEntity<ApiResponse<List<OrderAssignmentResponse>>> getOrderAssignments(
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.getAssignmentsForOrder(orderId)));
    }
}

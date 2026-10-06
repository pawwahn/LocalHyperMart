package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.delivery.dto.request.CreateHubAgentAlertRequest;
import com.hyperlocalmart.delivery.dto.request.CreateVendorAgentAlertRequest;
import com.hyperlocalmart.delivery.dto.request.VerifyHubPinRequest;
import com.hyperlocalmart.delivery.dto.response.AgentMeResponse;
import com.hyperlocalmart.delivery.dto.response.HubAdminContextResponse;
import com.hyperlocalmart.delivery.dto.response.HubContactResponse;
import com.hyperlocalmart.delivery.dto.response.OrderAssignmentResponse;
import com.hyperlocalmart.delivery.dto.response.VerifyHubPinResponse;
import com.hyperlocalmart.delivery.dto.request.AssignVendorDirectInternalRequest;
import com.hyperlocalmart.delivery.service.AgentService;
import com.hyperlocalmart.delivery.service.DeliveryPayoutLegService;
import com.hyperlocalmart.delivery.service.HubPinService;
import com.hyperlocalmart.delivery.dto.response.DeliveryAgentAlertResponse;
import com.hyperlocalmart.delivery.dto.response.SubOrderAgentAlertSummaryResponse;
import com.hyperlocalmart.delivery.service.DeliveryAgentAlertService;
import com.hyperlocalmart.delivery.service.VendorAgentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class DeliveryInternalController {

    private final AgentService agentService;
    private final HubPinService hubPinService;
    private final DeliveryPayoutLegService deliveryPayoutLegService;
    private final VendorAgentService vendorAgentService;
    private final DeliveryAgentAlertService deliveryAgentAlertService;

    @GetMapping("/api/v1/internal/agents/by-user/{userId}")
    public ResponseEntity<ApiResponse<AgentMeResponse>> getAgentByUser(
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.getMyAgent(userId)));
    }

    @GetMapping("/api/v1/internal/hubs/{hubId}")
    public ResponseEntity<ApiResponse<HubContactResponse>> getHubSnapshot(
            @PathVariable UUID hubId,
            HttpServletRequest httpRequest) {
        HubContactResponse hub = agentService.getHubSnapshot(hubId);
        if (hub == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, hub));
    }

    @GetMapping("/api/v1/internal/hubs/{hubId}/agents")
    public ResponseEntity<ApiResponse<List<com.hyperlocalmart.delivery.dto.response.AgentResponse>>> listHubAgents(
            @PathVariable UUID hubId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.listAgentsForHub(hubId)));
    }

    @GetMapping("/api/v1/internal/agents/{agentId}/display-name")
    public ResponseEntity<ApiResponse<java.util.Map<String, String>>> getAgentDisplayName(
            @PathVariable UUID agentId,
            HttpServletRequest httpRequest) {
        String name = agentService.getAgentDisplayName(agentId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, java.util.Map.of("name", name == null ? "" : name)));
    }

    @GetMapping("/api/v1/internal/vendors/{vendorId}/agents")
    public ResponseEntity<ApiResponse<List<com.hyperlocalmart.delivery.dto.response.AgentResponse>>> listVendorAgents(
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, vendorAgentService.listAgents(vendorId)));
    }

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

    @PostMapping("/api/v1/internal/orders/delivery-legs/resolve")
    public ResponseEntity<ApiResponse<List<DeliveryPayoutLegService.OrderLegs>>> resolveDeliveryLegs(
            @RequestBody List<UUID> orderIds,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, deliveryPayoutLegService.resolve(orderIds)));
    }

    @GetMapping("/api/v1/internal/agents/{agentId}/completed-delivery-order-ids")
    public ResponseEntity<ApiResponse<List<UUID>>> listCompletedDeliveryOrderIds(
            @PathVariable UUID agentId,
            @RequestParam Instant from,
            @RequestParam Instant to,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(
                ApiResponses.ok(httpRequest, deliveryPayoutLegService.completedDeliveryOrderIds(agentId, from, to)));
    }

    @GetMapping("/api/v1/internal/orders/{orderId}/assignments")
    public ResponseEntity<ApiResponse<List<OrderAssignmentResponse>>> getOrderAssignments(
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.getAssignmentsForOrder(orderId)));
    }

    @PostMapping("/api/v1/internal/vendor-sub-orders/{subOrderId}/assign-vendor-direct")
    public ResponseEntity<Void> assignVendorDirect(
            @PathVariable UUID subOrderId,
            @RequestBody AssignVendorDirectInternalRequest request) {
        vendorAgentService.assignVendorDirect(
                request.getVendorId(), subOrderId, request.getAgentId(), request.getAssignedBy());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/internal/vendor-sub-orders/{subOrderId}/agent-alerts")
    public ResponseEntity<ApiResponse<DeliveryAgentAlertResponse>> createAgentAlertForVendor(
            @PathVariable UUID subOrderId,
            @RequestBody CreateVendorAgentAlertRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                deliveryAgentAlertService.createForVendorSubOrder(
                        subOrderId, request.getVendorId(), request.getActorUserId())));
    }

    @PostMapping("/api/v1/internal/vendor-sub-orders/{subOrderId}/hub-agent-alerts")
    public ResponseEntity<ApiResponse<DeliveryAgentAlertResponse>> createAgentAlertForHub(
            @PathVariable UUID subOrderId,
            @RequestBody CreateHubAgentAlertRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                deliveryAgentAlertService.createForHubSubOrder(
                        subOrderId, request.getTownId(), request.getActorUserId())));
    }

    @PostMapping("/api/v1/internal/vendor-sub-orders/agent-alert-summaries")
    public ResponseEntity<ApiResponse<List<SubOrderAgentAlertSummaryResponse>>> agentAlertSummaries(
            @RequestBody List<UUID> vendorSubOrderIds,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                deliveryAgentAlertService.summarizeForSubOrders(vendorSubOrderIds)));
    }
}

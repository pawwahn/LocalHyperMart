package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.request.CreateAgentRequest;
import com.hyperlocalmart.delivery.dto.request.UpdateAgentStatusRequest;
import com.hyperlocalmart.delivery.dto.response.AgentResponse;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.AgentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

    @PostMapping("/api/v1/delivery/agents")
    public ResponseEntity<ApiResponse<AgentResponse>> createAgent(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateAgentRequest request,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        AgentResponse response = agentService.createAgent(principal.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }

    @GetMapping("/api/v1/delivery/agents")
    public ResponseEntity<ApiResponse<List<AgentResponse>>> listAgents(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID hubId,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                agentService.listAgents(principal.getUserId(), hubId)));
    }

    @GetMapping("/api/v1/delivery/admin/agents")
    public ResponseEntity<ApiResponse<List<AgentResponse>>> listAllAgents(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, agentService.listAllAgentsForSuperAdmin()));
    }

    @PatchMapping("/api/v1/delivery/agents/{agentId}/status")
    public ResponseEntity<ApiResponse<AgentResponse>> updateStatus(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID agentId,
            @Valid @RequestBody UpdateAgentStatusRequest request,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                agentService.updateAgentStatus(
                        principal.getUserId(), principal.getRoles(), agentId, request)));
    }

    /** Permanent disable (soft delete). Hub admins cannot call this. */
    @DeleteMapping("/api/v1/delivery/agents/{agentId}")
    public ResponseEntity<ApiResponse<AgentResponse>> permanentlyDisable(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID agentId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                agentService.permanentlyDisableAgent(principal.getUserId(), agentId)));
    }

    private void requireHubAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("HUB_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
        }
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }

    private void requireHubOrSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || (!principal.getRoles().contains("HUB_ADMIN")
                && !principal.getRoles().contains("SUPER_ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or super admin role required");
        }
    }
}

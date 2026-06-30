package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.response.AssignmentResponse;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.AssignmentService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/delivery/sub-orders")
@RequiredArgsConstructor
public class DeliverySubOrderController {

    private final AssignmentService assignmentService;

    @PostMapping("/{vendorSubOrderId}/at-hub")
    public ResponseEntity<ApiResponse<AssignmentResponse>> markAtHub(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorSubOrderId,
            HttpServletRequest httpRequest) {
        if (principal == null || !principal.getRoles().contains("HUB_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                assignmentService.markAtHub(principal.getUserId(), vendorSubOrderId)));
    }
}

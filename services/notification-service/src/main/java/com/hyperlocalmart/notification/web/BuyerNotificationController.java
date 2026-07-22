package com.hyperlocalmart.notification.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.notification.dto.response.BuyerNotificationResponse;
import com.hyperlocalmart.notification.security.AuthUserPrincipal;
import com.hyperlocalmart.notification.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class BuyerNotificationController {

    private final NotificationService notificationService;

    @GetMapping("/api/v1/notifications")
    public ResponseEntity<ApiResponse<List<BuyerNotificationResponse>>> listMine(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(defaultValue = "40") int limit,
            HttpServletRequest httpRequest) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, notificationService.listForBuyer(principal.getUserId(), limit)));
    }
}

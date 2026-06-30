package com.hyperlocalmart.notification.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.notification.dto.request.SendNotificationRequest;
import com.hyperlocalmart.notification.dto.response.NotificationResponse;
import com.hyperlocalmart.notification.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class NotificationInternalController {

    private final NotificationService notificationService;

    @PostMapping("/api/v1/internal/notifications/send")
    public ResponseEntity<ApiResponse<NotificationResponse>> send(
            @Valid @RequestBody SendNotificationRequest request,
            HttpServletRequest httpRequest) {
        NotificationResponse response = notificationService.send(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }
}

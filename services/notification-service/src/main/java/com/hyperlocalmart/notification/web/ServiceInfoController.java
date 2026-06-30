package com.hyperlocalmart.notification.web;

import com.hyperlocalmart.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/internal")
public class ServiceInfoController {
    @GetMapping("/info")
    public ApiResponse<Map<String, String>> info() {
        return ApiResponse.ok(Map.of("service", "notification-service", "status", "UP"));
    }
}

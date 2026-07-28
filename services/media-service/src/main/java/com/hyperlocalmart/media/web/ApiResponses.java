package com.hyperlocalmart.media.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.web.CorrelationIdFilter;
import jakarta.servlet.http.HttpServletRequest;

import java.time.Instant;

public final class ApiResponses {

    private ApiResponses() {
    }

    public static <T> ApiResponse<T> ok(HttpServletRequest request, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message("Operation successful")
                .data(data)
                .timestamp(Instant.now())
                .correlationId(CorrelationIdFilter.getCorrelationId(request))
                .build();
    }
}

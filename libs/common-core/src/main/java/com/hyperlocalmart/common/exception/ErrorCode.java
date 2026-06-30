package com.hyperlocalmart.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    VALIDATION_ERROR("Validation failed", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED("Unauthorized", HttpStatus.UNAUTHORIZED),
    FORBIDDEN("Forbidden", HttpStatus.FORBIDDEN),
    NOT_FOUND("Resource not found", HttpStatus.NOT_FOUND),
    CONFLICT("Conflict", HttpStatus.CONFLICT),
    TOWN_DISABLED("Town is not accepting orders", HttpStatus.FORBIDDEN),
    MIN_ORDER_NOT_MET("Minimum order value not met", HttpStatus.BAD_REQUEST),
    RATE_LIMITED("Too many requests", HttpStatus.TOO_MANY_REQUESTS),
    INTERNAL_ERROR("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);

    private final String defaultMessage;
    private final HttpStatus httpStatus;
}

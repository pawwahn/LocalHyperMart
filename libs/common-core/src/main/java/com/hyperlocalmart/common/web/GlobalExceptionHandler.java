package com.hyperlocalmart.common.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.FieldErrorDetail;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex, HttpServletRequest request) {
        return ResponseEntity.status(ex.getHttpStatus()).body(errorBody(ex.getErrorCode().name(), ex.getMessage(), request, null));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<List<FieldErrorDetail>>> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<FieldErrorDetail> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toFieldError)
                .toList();
        String message = errors.isEmpty()
                ? ErrorCode.VALIDATION_ERROR.getDefaultMessage()
                : errors.getFirst().getMessage();
        ApiResponse<List<FieldErrorDetail>> body = ApiResponse.<List<FieldErrorDetail>>builder()
                .success(false)
                .message(message)
                .data(errors)
                .timestamp(Instant.now())
                .correlationId(CorrelationIdFilter.getCorrelationId(request))
                .build();
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(
            DataIntegrityViolationException ex, HttpServletRequest request) {
        String raw = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        String message = "Could not save — check for duplicates or values that are too long";
        if (raw != null) {
            String lower = raw.toLowerCase();
            if (lower.contains("towns_name_state_key") || lower.contains("(name, state)")) {
                message = "A town with this name already exists in this state";
            } else if (lower.contains("towns_town_code_state_code_key") || lower.contains("(town_code, state_code)")) {
                message = "Town code already exists for this state";
            } else if (lower.contains("value too long") || lower.contains("22001")) {
                message = "A value is too long (town code and state code max 10 characters)";
            }
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(errorBody(ErrorCode.CONFLICT.name(), message, request, null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex, HttpServletRequest request) {
        org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class)
                .error("Unhandled error on {} {}: {}", request.getMethod(), request.getRequestURI(), ex.toString(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorBody(ErrorCode.INTERNAL_ERROR.name(), ErrorCode.INTERNAL_ERROR.getDefaultMessage(), request, null));
    }

    private FieldErrorDetail toFieldError(FieldError fieldError) {
        return FieldErrorDetail.builder()
                .field(fieldError.getField())
                .message(fieldError.getDefaultMessage())
                .build();
    }

    private ApiResponse<Void> errorBody(String errorCode, String message, HttpServletRequest request, Object data) {
        return ApiResponse.<Void>builder()
                .success(false)
                .message(message)
                .data(null)
                .timestamp(Instant.now())
                .correlationId(CorrelationIdFilter.getCorrelationId(request))
                .build();
    }
}

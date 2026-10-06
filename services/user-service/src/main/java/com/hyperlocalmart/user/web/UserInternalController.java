package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.dto.request.BindStaffContextRequest;
import com.hyperlocalmart.user.dto.request.ConsumeCodPinOtpRequest;
import com.hyperlocalmart.user.dto.request.CreateStaffUserRequest;
import com.hyperlocalmart.user.dto.request.UpdateUserStatusRequest;
import com.hyperlocalmart.user.dto.response.StaffUserResponse;
import com.hyperlocalmart.user.dto.response.UserProfileResponse;
import com.hyperlocalmart.user.service.CodPinOtpService;
import com.hyperlocalmart.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/users")
@RequiredArgsConstructor
public class UserInternalController {

    private final UserService userService;
    private final CodPinOtpService codPinOtpService;

    @GetMapping("/by-phone")
    public ResponseEntity<ApiResponse<UserProfileResponse>> findByPhone(
            @RequestParam String phone,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.findByPhone(phone)));
    }

    @PostMapping("/staff")
    public ResponseEntity<ApiResponse<StaffUserResponse>> createStaffUser(
            @Valid @RequestBody CreateStaffUserRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, userService.createStaffUser(request)));
    }

    @PatchMapping("/{userId}/context")
    public ResponseEntity<ApiResponse<StaffUserResponse>> bindStaffContext(
            @PathVariable UUID userId,
            @Valid @RequestBody BindStaffContextRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.bindStaffContext(userId, request)));
    }

    @PatchMapping("/{userId}/status")
    public ResponseEntity<ApiResponse<StaffUserResponse>> updateStatus(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserStatusRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.updateUserStatus(userId, request)));
    }

    @PostMapping("/{userId}/cod-pin-otp/consume")
    public ResponseEntity<ApiResponse<Void>> consumeCodPinOtp(
            @PathVariable UUID userId,
            @Valid @RequestBody ConsumeCodPinOtpRequest request,
            HttpServletRequest httpRequest) {
        codPinOtpService.consumeOtp(userId, request.getOtp());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }
}

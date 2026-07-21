package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.dto.request.CreateStaffUserRequest;
import com.hyperlocalmart.user.dto.request.UpdateUserStatusRequest;
import com.hyperlocalmart.user.dto.response.StaffUserResponse;
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

    @PostMapping("/staff")
    public ResponseEntity<ApiResponse<StaffUserResponse>> createStaffUser(
            @Valid @RequestBody CreateStaffUserRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, userService.createStaffUser(request)));
    }

    @PatchMapping("/{userId}/status")
    public ResponseEntity<ApiResponse<StaffUserResponse>> updateStatus(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserStatusRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.updateUserStatus(userId, request)));
    }
}

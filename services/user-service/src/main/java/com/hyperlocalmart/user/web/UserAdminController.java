package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.response.AddressResponse;
import com.hyperlocalmart.user.dto.response.UserProfileResponse;
import com.hyperlocalmart.user.security.AuthUserPrincipal;
import com.hyperlocalmart.user.service.AddressService;
import com.hyperlocalmart.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users/admin")
@RequiredArgsConstructor
public class UserAdminController {

    private final UserService userService;
    private final AddressService addressService;

    @GetMapping("/by-phone")
    public ResponseEntity<ApiResponse<UserProfileResponse>> findByPhone(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam String phone,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.findByPhone(phone)));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getUser(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.getProfile(userId)));
    }

    @GetMapping("/{userId}/addresses")
    public ResponseEntity<ApiResponse<List<AddressResponse>>> listAddresses(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, addressService.listAddresses(userId)));
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}

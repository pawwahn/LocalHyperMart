package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.dto.request.AcceptLegalRequest;
import com.hyperlocalmart.user.dto.request.DeleteAccountRequest;
import com.hyperlocalmart.user.dto.request.RegisterDeviceRequest;
import com.hyperlocalmart.user.dto.request.UpdatePrivacyPreferencesRequest;
import com.hyperlocalmart.user.dto.request.UpdateProfileRequest;
import com.hyperlocalmart.user.dto.response.DeviceRegistrationResponse;
import com.hyperlocalmart.user.dto.response.UserProfileResponse;
import com.hyperlocalmart.user.security.AuthUserPrincipal;
import com.hyperlocalmart.user.service.AccountPrivacyService;
import com.hyperlocalmart.user.service.CodPinOtpService;
import com.hyperlocalmart.user.service.DeviceTokenService;
import com.hyperlocalmart.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AccountPrivacyService accountPrivacyService;
    private final CodPinOtpService codPinOtpService;
    private final DeviceTokenService deviceTokenService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.getProfile(principal.getUserId())));
    }

    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.updateProfile(principal.getUserId(), request)));
    }

    @PostMapping("/me/accept-legal")
    public ResponseEntity<ApiResponse<UserProfileResponse>> acceptLegal(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody AcceptLegalRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, userService.acceptLegal(principal.getUserId(), request)));
    }

    @PatchMapping("/me/privacy")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updatePrivacy(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpdatePrivacyPreferencesRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                accountPrivacyService.updatePrivacyPreferences(principal.getUserId(), request)));
    }

    @PostMapping("/me/delete-account")
    public ResponseEntity<ApiResponse<Void>> deleteAccount(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody DeleteAccountRequest request,
            HttpServletRequest httpRequest) {
        accountPrivacyService.deleteBuyerAccount(principal.getUserId(), request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, "Account deleted", null));
    }

    /** OTP to registered phone — required before setting hub/shop COD PIN. */
    @PostMapping("/me/cod-pin-otp/request")
    public ResponseEntity<ApiResponse<Void>> requestCodPinOtp(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        codPinOtpService.requestOtp(principal.getUserId());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }

    @PostMapping("/me/devices")
    public ResponseEntity<ApiResponse<DeviceRegistrationResponse>> registerDevice(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody RegisterDeviceRequest request,
            HttpServletRequest httpRequest) {
        DeviceRegistrationResponse response = deviceTokenService.register(principal.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, "Device registered", response));
    }
}

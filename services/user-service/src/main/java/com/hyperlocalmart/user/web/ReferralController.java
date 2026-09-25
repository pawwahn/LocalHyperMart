package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.dto.request.ApplyReferralCodeRequest;
import com.hyperlocalmart.user.dto.response.ReferralMeResponse;
import com.hyperlocalmart.user.dto.response.ReferralValidateResponse;
import com.hyperlocalmart.user.security.AuthUserPrincipal;
import com.hyperlocalmart.user.service.ReferralService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/referrals")
@RequiredArgsConstructor
public class ReferralController {

    private final ReferralService referralService;

    @GetMapping("/validate")
    public ResponseEntity<ApiResponse<ReferralValidateResponse>> validate(
            @RequestParam String code,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, referralService.validate(code)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<ReferralMeResponse>> me(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, referralService.getMe(principal.getUserId())));
    }

    @PostMapping("/apply")
    public ResponseEntity<ApiResponse<ReferralMeResponse>> apply(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody ApplyReferralCodeRequest request,
            HttpServletRequest httpRequest) {
        referralService.applyAtCart(principal.getUserId(), request.getCode());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, referralService.getMe(principal.getUserId())));
    }
}

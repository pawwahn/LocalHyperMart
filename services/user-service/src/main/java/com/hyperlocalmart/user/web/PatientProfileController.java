package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.request.UpsertPatientProfileRequest;
import com.hyperlocalmart.user.dto.response.PatientProfileResponse;
import com.hyperlocalmart.user.security.AuthUserPrincipal;
import com.hyperlocalmart.user.service.PatientProfileService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users/me/patients")
@RequiredArgsConstructor
public class PatientProfileController {

    private final PatientProfileService patientProfileService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PatientProfileResponse>>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireBuyer(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, patientProfileService.list(principal.getUserId())));
    }

    @GetMapping("/{patientId}")
    public ResponseEntity<ApiResponse<PatientProfileResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID patientId,
            HttpServletRequest httpRequest) {
        requireBuyer(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, patientProfileService.get(principal.getUserId(), patientId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PatientProfileResponse>> create(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertPatientProfileRequest request,
            HttpServletRequest httpRequest) {
        requireBuyer(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                patientProfileService.create(principal.getUserId(), request)));
    }

    @PutMapping("/{patientId}")
    public ResponseEntity<ApiResponse<PatientProfileResponse>> update(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID patientId,
            @Valid @RequestBody UpsertPatientProfileRequest request,
            HttpServletRequest httpRequest) {
        requireBuyer(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                patientProfileService.update(principal.getUserId(), patientId, request)));
    }

    @DeleteMapping("/{patientId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID patientId,
            HttpServletRequest httpRequest) {
        requireBuyer(principal);
        patientProfileService.deactivate(principal.getUserId(), patientId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, "Patient removed", null));
    }

    private static void requireBuyer(AuthUserPrincipal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Login required");
        }
    }
}

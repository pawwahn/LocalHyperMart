package com.hyperlocalmart.user.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.dto.response.PatientProfileResponse;
import com.hyperlocalmart.user.service.PatientProfileService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/users")
@RequiredArgsConstructor
public class PatientInternalController {

    private final PatientProfileService patientProfileService;

    @GetMapping("/{accountUserId}/patients/{patientId}")
    public ResponseEntity<ApiResponse<PatientProfileResponse>> getPatient(
            @PathVariable UUID accountUserId,
            @PathVariable UUID patientId,
            @RequestParam(required = false) UUID userId,
            HttpServletRequest httpRequest) {
        UUID owner = userId != null ? userId : accountUserId;
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, patientProfileService.getInternal(owner, patientId)));
    }
}

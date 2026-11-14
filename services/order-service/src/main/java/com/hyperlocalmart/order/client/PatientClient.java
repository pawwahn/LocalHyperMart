package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.config.RestClientFactory;
import com.hyperlocalmart.order.config.UserServiceProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PatientClient {

    private final RestClientFactory restClients;
    private final UserServiceProperties userServiceProperties;

    public PatientView getPatient(UUID buyerId, UUID patientId) {
        RestClient client = restClients.forBaseUrl(userServiceProperties.getBaseUrl());
        try {
            ApiResponse<PatientView> response = client.get()
                    .uri("/api/v1/internal/users/{buyerId}/patients/{patientId}", buyerId, patientId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<PatientView>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Patient profile not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Patient profile not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load patient profile");
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PatientView(UUID id, String displayName, String relation, String gender) {
    }
}

package com.hyperlocalmart.delivery.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.config.TownServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TownClient {

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    public void requireEnabledTown(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/exists", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
            }
            Object exists = response.getData().get("exists");
            if (!(exists instanceof Boolean enabled) || !enabled) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Town is missing or disabled — enable it before creating a hub");
            }
        } catch (BusinessException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not validate town");
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not validate town");
        }
    }
}

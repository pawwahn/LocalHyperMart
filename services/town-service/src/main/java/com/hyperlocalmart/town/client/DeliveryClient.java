package com.hyperlocalmart.town.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.config.DeliveryServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class DeliveryClient {

    private final RestClient.Builder restClientBuilder;
    private final DeliveryServiceProperties deliveryServiceProperties;

    public HubAdminContext getHubAdminContext(UUID userId) {
        try {
            RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
            ApiResponse<HubAdminContext> response = client.get()
                    .uri("/api/v1/internal/hub-admins/{userId}/context", userId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<HubAdminContext>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin context not found");
            }
            return response.getData();
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Could not verify hub admin for this town");
        }
    }

    public record HubAdminContext(UUID userId, UUID hubId, UUID townId) {
    }
}

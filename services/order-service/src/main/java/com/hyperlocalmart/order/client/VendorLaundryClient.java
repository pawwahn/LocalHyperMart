package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.config.VendorServiceProperties;
import lombok.RequiredArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VendorLaundryClient {

    private final RestClient.Builder restClientBuilder;
    private final VendorServiceProperties vendorServiceProperties;

    public List<LaundryShopView> bookableShops(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<List<LaundryShopView>> response = client.get()
                    .uri("/api/v1/internal/vendors/laundry/shops?townId={townId}", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<LaundryShopView>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load laundry shops");
        }
    }

    public LaundryShopView shop(UUID vendorId) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<LaundryShopView> response = client.get()
                    .uri("/api/v1/internal/vendors/laundry/shops/{vendorId}", vendorId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<LaundryShopView>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Laundry shop not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Laundry shop not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load laundry shop");
        }
    }

    public UUID vendorIdForUser(UUID userId) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<java.util.Map<String, String>> response = client.get()
                    .uri("/api/v1/internal/vendors/laundry/by-user/{userId}", userId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<java.util.Map<String, String>>>() {});
            if (response == null || response.getData() == null || response.getData().get("vendorId") == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found");
            }
            return UUID.fromString(response.getData().get("vendorId"));
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load vendor");
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LaundryShopView(
            UUID vendorId,
            UUID townId,
            String businessName,
            String phone,
            String vendorStatus,
            boolean enabled,
            Integer dailyPieceCapacity,
            String closedWeekdays,
            BigDecimal pickupCharge,
            BigDecimal dropCharge,
            BigDecimal pickupAndDropCharge,
            String feeModel,
            BigDecimal perPieceAmount,
            BigDecimal perOrderFlatAmount,
            BigDecimal monthlySubscriptionAmount,
            List<RateView> rates
    ) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        public record RateView(String serviceType, String itemType, BigDecimal unitPrice, Boolean paused) {
            public RateView {
                if (paused == null) {
                    paused = Boolean.FALSE;
                }
            }

            public boolean hidden() {
                return Boolean.TRUE.equals(paused);
            }
        }
    }
}

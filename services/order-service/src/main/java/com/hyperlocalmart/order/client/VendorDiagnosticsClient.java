package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.config.RestClientFactory;
import com.hyperlocalmart.order.config.VendorServiceProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VendorDiagnosticsClient {

    private final RestClientFactory restClients;
    private final VendorServiceProperties vendorServiceProperties;

    public List<DiagnosticsLabView> bookableLabs(UUID townId) {
        RestClient client = restClients.forBaseUrl(vendorServiceProperties.getBaseUrl());
        try {
            ApiResponse<List<DiagnosticsLabView>> response = client.get()
                    .uri("/api/v1/internal/vendors/diagnostics/labs?townId={townId}", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<DiagnosticsLabView>>>() {});
            return response == null || response.getData() == null ? List.of() : response.getData();
        } catch (RestClientResponseException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load diagnostics labs");
        }
    }

    public DiagnosticsLabDetailView lab(UUID vendorId) {
        RestClient client = restClients.forBaseUrl(vendorServiceProperties.getBaseUrl());
        try {
            ApiResponse<DiagnosticsLabDetailView> response = client.get()
                    .uri("/api/v1/internal/vendors/diagnostics/labs/{vendorId}", vendorId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<DiagnosticsLabDetailView>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Lab not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Lab not found", "Could not load lab");
        }
    }

    public UUID vendorIdForUser(UUID userId) {
        RestClient client = restClients.forBaseUrl(vendorServiceProperties.getBaseUrl());
        try {
            ApiResponse<Map<String, String>> response = client.get()
                    .uri("/api/v1/internal/vendors/diagnostics/by-user/{userId}", userId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, String>>>() {});
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

    public StaffContextView staffContext(UUID userId) {
        RestClient client = restClients.forBaseUrl(vendorServiceProperties.getBaseUrl());
        try {
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/vendors/diagnostics/staff-context/{userId}", userId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Staff context not found");
            }
            Map<String, Object> data = response.getData();
            return new StaffContextView(
                    UUID.fromString(String.valueOf(data.get("vendorId"))),
                    parseUuid(data.get("staffId")),
                    String.valueOf(data.get("roleType")),
                    data.get("title") == null ? null : String.valueOf(data.get("title")),
                    Boolean.TRUE.equals(data.get("collectionCapable")),
                    Boolean.TRUE.equals(data.get("vendorOwner")));
        } catch (RestClientResponseException ex) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Diagnostics vendor access required");
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DiagnosticsLabView(
            UUID vendorId,
            UUID townId,
            String businessName,
            String phone,
            boolean enabled,
            boolean bookable,
            BigDecimal homeCollectionFee,
            int activeBranchCount,
            List<TestView> tests,
            List<PackageView> packages) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DiagnosticsLabDetailView(
            UUID vendorId,
            UUID townId,
            String businessName,
            String vendorStatus,
            boolean enabled,
            boolean bookable,
            BigDecimal homeCollectionFee,
            List<BranchView> branches,
            List<TestView> tests,
            List<PackageView> packages) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BranchView(
            UUID id,
            String label,
            Double latitude,
            Double longitude,
            BigDecimal homeCollectionRadiusKm,
            boolean active,
            String blockedSlotsByDate,
            List<SlotView> slots) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SlotView(UUID id, String label, String startTime, String endTime, int capacity, boolean active) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TestView(
            UUID id,
            String code,
            String name,
            BigDecimal price,
            String fastingNote,
            boolean prescriptionRequired,
            boolean homeCollection,
            boolean active) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PackageView(
            UUID id,
            String code,
            String name,
            String description,
            BigDecimal price,
            boolean active,
            List<UUID> testIds) {
    }

    public record StaffContextView(
            UUID vendorId,
            UUID staffId,
            String roleType,
            String title,
            boolean collectionCapable,
            boolean vendorOwner) {
    }

    private static UUID parseUuid(Object raw) {
        if (raw == null) {
            return null;
        }
        String text = String.valueOf(raw).trim();
        if (text.isEmpty()) {
            return null;
        }
        return UUID.fromString(text);
    }

    private static BusinessException mapClientError(
            RestClientResponseException ex, String notFoundFallback, String defaultFallback) {
        if (ex.getStatusCode().value() == 404) {
            return new BusinessException(ErrorCode.NOT_FOUND, notFoundFallback);
        }
        return new BusinessException(ErrorCode.INTERNAL_ERROR, defaultFallback);
    }
}

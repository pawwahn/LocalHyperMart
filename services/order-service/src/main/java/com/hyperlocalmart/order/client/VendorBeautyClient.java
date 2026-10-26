package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.beauty.BeautySlotSchedule;
import com.hyperlocalmart.common.beauty.BeautyStaffOverrides;
import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.config.VendorServiceProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VendorBeautyClient {

    private final RestClient.Builder restClientBuilder;
    private final VendorServiceProperties vendorServiceProperties;

    public List<BeautyArtistView> bookableArtists(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<List<BeautyArtistView>> response = client.get()
                    .uri("/api/v1/internal/vendors/beauty/artists?townId={townId}", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<BeautyArtistView>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load beauty artists");
        }
    }

    public BeautyArtistView artist(UUID vendorId) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<BeautyArtistView> response = client.get()
                    .uri("/api/v1/internal/vendors/beauty/artists/{vendorId}", vendorId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<BeautyArtistView>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Artist not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Artist not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load artist");
        }
    }

    public UUID vendorIdForUser(UUID userId) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<java.util.Map<String, String>> response = client.get()
                    .uri("/api/v1/internal/vendors/beauty/by-user/{userId}", userId)
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
    public record BeautyArtistView(
            UUID vendorId,
            UUID townId,
            String businessName,
            String phone,
            String vendorStatus,
            boolean enabled,
            String tagline,
            Integer yearsExperience,
            BigDecimal ratingScore,
            Integer ratingCount,
            BigDecimal homeVisitCharge,
            String studioAddress,
            String closedWeekdays,
            String blockedSlotDate,
            String blockedSlotIds,
            String blockedSlotsByDate,
            Integer staffCount,
            String slotDayOpen,
            String slotDayClose,
            Integer slotIntervalMinutes,
            String staffOverrides,
            java.math.BigDecimal bookingMinPrepayAmount,
            List<RateView> rates
    ) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        public record RateView(
                String serviceType,
                String label,
                String hint,
                String emoji,
                BigDecimal unitPrice,
                Integer durationMinutes,
                Boolean paused) {
            public RateView {
                if (paused == null) {
                    paused = Boolean.FALSE;
                }
                if (durationMinutes == null) {
                    durationMinutes = 60;
                }
            }

            public boolean hidden() {
                return Boolean.TRUE.equals(paused);
            }
        }

        public int staffCapacity() {
            return staffCount == null || staffCount < 1 ? 1 : Math.min(staffCount, 50);
        }

        public BeautySlotSchedule slotSchedule() {
            return BeautySlotSchedule.parseSafe(slotDayOpen, slotDayClose, slotIntervalMinutes);
        }

        public int staffCapacityFor(java.time.LocalDate day) {
            return BeautyStaffOverrides.effective(staffCapacity(), staffOverrides, day);
        }
    }
}

package com.hyperlocalmart.cart.client;

import com.hyperlocalmart.cart.config.TownServiceProperties;
import com.hyperlocalmart.common.api.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TownConfigClient {

    private static final BigDecimal DEFAULT_MIN_ORDER = new BigDecimal("199");

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    public BigDecimal getMinOrderValue(UUID townId) {
        OperationalConfig config = getOperationalConfig(townId);
        if (config == null || config.minOrderValue() == null) {
            return DEFAULT_MIN_ORDER;
        }
        return config.minOrderValue();
    }

    public OperationalConfig getOperationalConfig(UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<OperationalConfig> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/operational-config", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<OperationalConfig>>() {});
            if (response == null || response.getData() == null) {
                return null;
            }
            return response.getData();
        } catch (Exception ex) {
            return null;
        }
    }

    public record OperationalConfig(BigDecimal minOrderValue, Boolean buyerMembershipEnabled) {
        public boolean sellsMembership() {
            return buyerMembershipEnabled == null || buyerMembershipEnabled;
        }
    }

    public record MembershipSlabOffer(String code, int months, BigDecimal price, int credits) {
    }

    public record MembershipConfig(boolean enabled, MembershipSlabOffer quarterly, MembershipSlabOffer halfYear, MembershipSlabOffer annual) {
        public MembershipSlabOffer slab(String code) {
            if (code == null) {
                return null;
            }
            return switch (code.trim().toUpperCase()) {
                case "QUARTERLY" -> quarterly;
                case "HALF_YEAR" -> halfYear;
                case "ANNUAL" -> annual;
                default -> null;
            };
        }
    }

    public MembershipConfig getMembershipConfig() {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<MembershipConfigPayload> response = client.get()
                    .uri("/api/v1/internal/platform/membership-config")
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<MembershipConfigPayload>>() {});
            if (response == null || response.getData() == null) {
                return null;
            }
            MembershipConfigPayload data = response.getData();
            return new MembershipConfig(
                    data.enabled(),
                    toSlab(data.quarterly()),
                    toSlab(data.halfYear()),
                    toSlab(data.annual()));
        } catch (Exception ex) {
            return null;
        }
    }

    private static MembershipSlabOffer toSlab(MembershipConfigPayload.Slab slab) {
        if (slab == null) {
            return null;
        }
        return new MembershipSlabOffer(
                slab.code(),
                slab.months(),
                slab.price() == null ? BigDecimal.ZERO : slab.price(),
                slab.credits());
    }

    public record MembershipConfigPayload(
            boolean enabled,
            MembershipConfigPayload.Slab quarterly,
            MembershipConfigPayload.Slab halfYear,
            MembershipConfigPayload.Slab annual) {
        public record Slab(String code, int months, BigDecimal price, int credits) {
        }
    }
}

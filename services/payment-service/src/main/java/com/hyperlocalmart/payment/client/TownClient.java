package com.hyperlocalmart.payment.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.config.TownServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TownClient {

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    public MembershipConfig membershipConfig() {
        RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
        ApiResponse<MembershipConfig> response = client.get()
                .uri("/api/v1/internal/platform/membership-config")
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<MembershipConfig>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Membership config unavailable");
        }
        return response.getData();
    }

    public DeliveryPayoutConfig deliveryPayoutConfig(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
        ApiResponse<DeliveryPayoutConfig> response = client.get()
                .uri("/api/v1/internal/towns/{townId}/delivery-payout-config", townId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<DeliveryPayoutConfig>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Delivery payout config unavailable");
        }
        return response.getData();
    }

    public VendorAgentDeliveryConfig vendorAgentDeliveryConfig(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
        ApiResponse<VendorAgentDeliveryConfig> response = client.get()
                .uri("/api/v1/internal/towns/{townId}/vendor-agent-delivery-config", townId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<VendorAgentDeliveryConfig>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Vendor-agent delivery config unavailable");
        }
        return response.getData();
    }

    public TownOperationalConfig townConfig(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
        ApiResponse<TownOperationalConfig> response = client.get()
                .uri("/api/v1/internal/towns/{townId}/operational-config", townId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<TownOperationalConfig>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Town config unavailable");
        }
        return response.getData();
    }

    public record MembershipConfig(
            boolean enabled,
            Slab quarterly,
            Slab halfYear,
            Slab annual
    ) {
        public Slab slab(String code) {
            if (code == null) return null;
            return switch (code.trim().toUpperCase()) {
                case "QUARTERLY" -> quarterly;
                case "HALF_YEAR" -> halfYear;
                case "ANNUAL" -> annual;
                default -> null;
            };
        }
    }

    public record Slab(String code, int months, BigDecimal price, int credits) {
    }

    public record VendorAgentDeliveryConfig(
            boolean enabled,
            BigDecimal vendorAgentPayoutAmount,
            BigDecimal hubPayoutAmount
    ) {
    }

    public record DeliveryPayoutConfig(Party agent, Party hub) {
        public record Party(boolean enabled, PerOrder perOrder, Franchise franchise) {
        }

        public record PerOrder(
                boolean enabled,
                BigDecimal pickupAmount,
                BigDecimal lastMileAmount,
                BigDecimal completedOrderAmount
        ) {
        }

        public record Franchise(boolean enabled, String cadence, BigDecimal amount, String effectiveFrom) {
        }
    }

    public void appendAdminAudit(
            String screenKey, String action, String summary, UUID actorId, UUID townId, UUID entityId) {
        appendAdminAudit(screenKey, action, summary, actorId, townId, entityId, null, null, null);
    }

    public void appendAdminAudit(
            String screenKey,
            String action,
            String summary,
            UUID actorId,
            UUID townId,
            UUID entityId,
            Map<String, Object> before,
            Map<String, Object> after,
            List<String> changeLines) {
        try {
            java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("screenKey", screenKey);
            body.put("action", action);
            body.put("changeSummary", summary);
            body.put("actorUserId", actorId);
            body.put("actorRole", "SUPER_ADMIN");
            if (changeLines != null) body.put("entityType", "MEMBERSHIP");
            if (townId != null) body.put("townId", townId);
            if (entityId != null) body.put("entityId", entityId);
            if (before != null) body.put("beforeSnapshot", before);
            if (after != null) body.put("afterSnapshot", after);
            if (changeLines != null && !changeLines.isEmpty()) body.put("changeLines", changeLines);
            restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build()
                    .post()
                    .uri("/api/v1/internal/admin-audit")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ignored) {
        }
    }

    public record TownOperationalConfig(Boolean buyerMembershipEnabled) {
        public boolean sellsMembership() {
            return buyerMembershipEnabled == null || buyerMembershipEnabled;
        }
    }

    public TownSummary getTownSummary(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
        ApiResponse<TownSummary> response = client.get()
                .uri("/api/v1/internal/towns/{townId}/summary", townId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<TownSummary>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Town summary unavailable");
        }
        return response.getData();
    }

    public record TownSummary(String townCode, String stateCode, String displayName) {
    }
}

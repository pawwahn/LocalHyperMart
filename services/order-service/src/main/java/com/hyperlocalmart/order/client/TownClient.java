package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.TownServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TownClient {

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    public TownSummary getTownSummary(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
        ApiResponse<TownSummary> response = client.get()
                .uri("/api/v1/internal/towns/{townId}/summary", townId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<TownSummary>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Town service returned empty summary");
        }
        return response.getData();
    }

    /** Town delivery + buyer platform fee. Nulls mean “use caller fallback”. */
    public CheckoutFees resolveTownCheckoutFees(UUID townId, BigDecimal orderValue) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            String uri = orderValue == null
                    ? "/api/v1/internal/towns/{townId}/delivery-fee"
                    : "/api/v1/internal/towns/{townId}/delivery-fee?orderValue={orderValue}";
            ApiResponse<Map<String, Object>> response = (orderValue == null
                    ? client.get().uri(uri, townId)
                    : client.get().uri(uri, townId, orderValue))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return new CheckoutFees(null, BigDecimal.ZERO);
            }
            Map<String, Object> data = response.getData();
            BigDecimal platformFee = money(data.get("platformFee"));
            return new CheckoutFees(
                    money(data.get("deliveryFee")),
                    platformFee == null ? BigDecimal.ZERO : platformFee.max(BigDecimal.ZERO));
        } catch (Exception ex) {
            return new CheckoutFees(null, BigDecimal.ZERO);
        }
    }

    /** Resolve town delivery fee (DEFAULT/platform or SLAB). Falls back to null on failure. */
    public BigDecimal resolveTownDeliveryFee(UUID townId, BigDecimal orderValue) {
        return resolveTownCheckoutFees(townId, orderValue).deliveryFee();
    }

    /** Platform-wide delivery fee (independent of town). Falls back to null on failure. */
    public BigDecimal getPlatformDeliveryFee() {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/platform/delivery-fee")
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return null;
            }
            return money(response.getData().get("deliveryFee"));
        } catch (Exception ex) {
            return null;
        }
    }

    public PaymentSettings getPaymentSettings(UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/operational-config", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return PaymentSettings.defaults();
            }
            Map<String, Object> data = response.getData();
            boolean codEnabled = !Boolean.FALSE.equals(data.get("codEnabled"))
                    && !"false".equalsIgnoreCase(String.valueOf(data.get("codEnabled")));
            boolean upiEnabled = !Boolean.FALSE.equals(data.get("upiEnabled"))
                    && !"false".equalsIgnoreCase(String.valueOf(data.get("upiEnabled")));
            BigDecimal codCharge = money(data.get("codCharge"));
            if (codCharge == null || codCharge.compareTo(BigDecimal.ZERO) < 0) {
                codCharge = BigDecimal.ZERO;
            }
            return new PaymentSettings(codEnabled, upiEnabled, codCharge);
        } catch (Exception ex) {
            return PaymentSettings.defaults();
        }
    }

    public ScratchSettings getScratchSettings(UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/operational-config", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return ScratchSettings.disabled();
            }
            Map<String, Object> data = response.getData();
            boolean enabled = Boolean.TRUE.equals(data.get("scratchCardEnabled"))
                    || "true".equalsIgnoreCase(String.valueOf(data.get("scratchCardEnabled")));
            BigDecimal min = money(data.get("scratchRewardMin"));
            BigDecimal max = money(data.get("scratchRewardMax"));
            BigDecimal threshold = money(data.get("scratchMinGoodsAmount"));
            if (!enabled || min == null || max == null || threshold == null || max.compareTo(min) < 0) {
                return ScratchSettings.disabled();
            }
            return new ScratchSettings(true, min, max, threshold);
        } catch (Exception ex) {
            return ScratchSettings.disabled();
        }
    }

    private static BigDecimal money(Object raw) {
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).setScale(2, java.math.RoundingMode.HALF_UP);
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new BigDecimal(s.trim()).setScale(2, java.math.RoundingMode.HALF_UP);
        }
        return null;
    }

    public void appendAdminAudit(
            String screenKey, String action, String summary, UUID actorId, UUID townId, UUID entityId) {
        try {
            Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("screenKey", screenKey);
            body.put("action", action);
            body.put("changeSummary", summary);
            body.put("actorUserId", actorId);
            body.put("actorRole", "SUPER_ADMIN");
            if (townId != null) body.put("townId", townId);
            if (entityId != null) body.put("entityId", entityId);
            restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build()
                    .post()
                    .uri("/api/v1/internal/admin-audit")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ignored) {
        }
    }

    public record TownSummary(String townCode, String stateCode, String displayName) {
    }

    public record CheckoutFees(BigDecimal deliveryFee, BigDecimal platformFee) {
    }

    public record PaymentSettings(boolean codEnabled, boolean upiEnabled, BigDecimal codCharge) {
        static PaymentSettings defaults() {
            return new PaymentSettings(true, true, BigDecimal.ZERO);
        }
    }

    public record ScratchSettings(boolean enabled, BigDecimal rewardMin, BigDecimal rewardMax, BigDecimal minGoodsAmount) {
        static ScratchSettings disabled() {
            return new ScratchSettings(false, null, null, null);
        }
    }
}

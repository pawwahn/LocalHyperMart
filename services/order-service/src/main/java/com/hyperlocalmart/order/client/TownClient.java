package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.TownServiceProperties;
import com.hyperlocalmart.order.scratch.ScratchServiceKind;
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

    public BuyerCancelPolicy getBuyerCancelPolicy(UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/buyer-cancel-policy", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return BuyerCancelPolicy.defaults();
            }
            Map<String, Object> data = response.getData();
            boolean cancelOrder = !Boolean.FALSE.equals(data.get("cancelOrderEnabled"))
                    && !"false".equalsIgnoreCase(String.valueOf(data.get("cancelOrderEnabled")));
            boolean cancelItems = !Boolean.FALSE.equals(data.get("cancelItemsEnabled"))
                    && !"false".equalsIgnoreCase(String.valueOf(data.get("cancelItemsEnabled")));
            return new BuyerCancelPolicy(cancelOrder, cancelItems);
        } catch (Exception ex) {
            return BuyerCancelPolicy.defaults();
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

    public BeautyBookingSettings getBeautyBookingSettings(UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/operational-config", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return BeautyBookingSettings.defaults();
            }
            Map<String, Object> data = response.getData();
            BigDecimal minPrepay = money(data.get("beautyMinPrepayAmount"));
            BigDecimal parlourFee = money(data.get("beautyParlourPaymentFee"));
            if (minPrepay == null || minPrepay.compareTo(BigDecimal.ZERO) < 0) {
                minPrepay = BigDecimal.ZERO;
            }
            if (parlourFee == null || parlourFee.compareTo(BigDecimal.ZERO) < 0) {
                parlourFee = BigDecimal.ZERO;
            }
            return new BeautyBookingSettings(minPrepay, parlourFee);
        } catch (Exception ex) {
            return BeautyBookingSettings.defaults();
        }
    }

    public ScratchSettings getScratchSettings(UUID townId) {
        return getScratchSettings(townId, ScratchServiceKind.GROCERY.name());
    }

    public ScratchSettings getScratchSettings(UUID townId, String serviceKind) {
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
            String kind = ScratchServiceKind.parse(serviceKind).name();
            Object byServiceRaw = data.get("scratchByService");
            if (byServiceRaw instanceof Map<?, ?> byService) {
                Object row = byService.get(kind);
                if (row instanceof Map<?, ?> rule) {
                    ScratchSettings parsed = scratchFromRuleMap(rule);
                    if (parsed != null) {
                        return parsed;
                    }
                }
            }
            if (ScratchServiceKind.GROCERY.name().equals(kind)) {
                boolean enabled = Boolean.TRUE.equals(data.get("scratchCardEnabled"))
                        || "true".equalsIgnoreCase(String.valueOf(data.get("scratchCardEnabled")));
                BigDecimal min = money(data.get("scratchRewardMin"));
                BigDecimal max = money(data.get("scratchRewardMax"));
                BigDecimal threshold = money(data.get("scratchMinGoodsAmount"));
                if (!enabled || min == null || max == null || threshold == null || max.compareTo(min) < 0) {
                    return ScratchSettings.disabled();
                }
                return new ScratchSettings(true, min, max, threshold, "BOTH", false, false, null, null, null);
            }
            return ScratchSettings.disabled();
        } catch (Exception ex) {
            return ScratchSettings.disabled();
        }
    }

    private static ScratchSettings scratchFromRuleMap(Map<?, ?> rule) {
        boolean enabled = Boolean.TRUE.equals(rule.get("enabled"))
                || "true".equalsIgnoreCase(String.valueOf(rule.get("enabled")));
        BigDecimal min = money(rule.get("rewardMin"));
        BigDecimal max = money(rule.get("rewardMax"));
        BigDecimal threshold = money(rule.get("minOrderAmount"));
        if (!enabled || min == null || max == null || threshold == null || max.compareTo(min) < 0) {
            return ScratchSettings.disabled();
        }
        String prepay = rule.get("prepayModeFilter") == null
                ? "BOTH"
                : String.valueOf(rule.get("prepayModeFilter")).trim().toUpperCase();
        boolean issueAfterRating = Boolean.TRUE.equals(rule.get("issueAfterRating"))
                || "true".equalsIgnoreCase(String.valueOf(rule.get("issueAfterRating")));
        boolean partialEnabled = readJsonBool(rule.get("partialPrepayEnabled"), false);
        BigDecimal partialMin = money(rule.get("partialRewardMin"));
        BigDecimal partialMax = money(rule.get("partialRewardMax"));
        BigDecimal partialThreshold = money(rule.get("partialMinPrepayAmount"));
        if (partialEnabled && (partialMin == null || partialMax == null || partialThreshold == null
                || partialMax.compareTo(partialMin) < 0)) {
            partialEnabled = false;
        }
        return new ScratchSettings(
                true,
                min,
                max,
                threshold,
                prepay,
                issueAfterRating,
                partialEnabled,
                partialMin,
                partialMax,
                partialThreshold);
    }

    private static boolean readJsonBool(Object raw, boolean fallback) {
        if (raw instanceof Boolean b) {
            return b;
        }
        if (raw instanceof Number n) {
            return n.intValue() != 0;
        }
        if (raw == null) {
            return fallback;
        }
        String text = String.valueOf(raw).trim();
        if ("true".equalsIgnoreCase(text) || "1".equals(text)) {
            return true;
        }
        if ("false".equalsIgnoreCase(text) || "0".equals(text)) {
            return false;
        }
        return fallback;
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

    /** Whether hub admins may see buyer ratings of delivery agents. Defaults to true if town-service is unreachable. */
    public boolean hubAdminCanSeeAgentRatings() {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/platform/settings-flags")
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return true;
            }
            Object raw = response.getData().get("hubAdminCanSeeAgentRatings");
            if (raw instanceof Boolean b) {
                return b;
            }
            if (raw == null) {
                return true;
            }
            return !"false".equalsIgnoreCase(String.valueOf(raw).trim());
        } catch (Exception ex) {
            return true;
        }
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

    /** False when the town has laundry off, or when town-service cannot be read. */
    public boolean isLaundryEnabled(UUID townId) {
        return shopFlag(townId, "laundryEnabled");
    }

    /** False when makeup & beauty is off for the town, or when town-service cannot be read. */
    public boolean isBeautyEnabled(UUID townId) {
        return shopFlag(townId, "beautyEnabled");
    }

    private boolean shopFlag(UUID townId, String key) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/towns/{townId}/shop-settings", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return false;
            }
            Object flag = response.getData().get(key);
            return Boolean.TRUE.equals(flag) || "true".equalsIgnoreCase(String.valueOf(flag));
        } catch (Exception ex) {
            return false;
        }
    }

    public VendorAgentDeliverySettings getVendorAgentDeliverySettings(UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/vendor-agent-delivery-config", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return VendorAgentDeliverySettings.disabled();
            }
            Map<String, Object> data = response.getData();
            return new VendorAgentDeliverySettings(
                    Boolean.TRUE.equals(data.get("enabled")),
                    money(data.get("vendorAgentPayoutAmount")),
                    money(data.get("hubPayoutAmount")));
        } catch (Exception ex) {
            return VendorAgentDeliverySettings.disabled();
        }
    }

    public record TownSummary(String townCode, String stateCode, String displayName, List<String> pincodes) {
        @com.fasterxml.jackson.annotation.JsonIgnore
        public TownSummary(String townCode, String stateCode, String displayName) {
            this(townCode, stateCode, displayName, List.of());
        }
    }

    public record VendorAgentDeliverySettings(
            boolean enabled, BigDecimal vendorAgentPayoutAmount, BigDecimal hubPayoutAmount) {
        static VendorAgentDeliverySettings disabled() {
            return new VendorAgentDeliverySettings(false, BigDecimal.ZERO, BigDecimal.ZERO);
        }
    }

    public record CheckoutFees(BigDecimal deliveryFee, BigDecimal platformFee) {
    }

    public record BeautyBookingSettings(BigDecimal beautyMinPrepayAmount, BigDecimal beautyParlourPaymentFee) {
        static BeautyBookingSettings defaults() {
            return new BeautyBookingSettings(BigDecimal.ZERO.setScale(2, java.math.RoundingMode.HALF_UP),
                    BigDecimal.ZERO.setScale(2, java.math.RoundingMode.HALF_UP));
        }
    }

    public record PaymentSettings(boolean codEnabled, boolean upiEnabled, BigDecimal codCharge) {
        static PaymentSettings defaults() {
            return new PaymentSettings(true, true, BigDecimal.ZERO);
        }
    }

    public record ScratchSettings(
            boolean enabled,
            BigDecimal rewardMin,
            BigDecimal rewardMax,
            BigDecimal minGoodsAmount,
            String prepayModeFilter,
            boolean issueAfterRating,
            boolean partialPrepayEnabled,
            BigDecimal partialRewardMin,
            BigDecimal partialRewardMax,
            BigDecimal partialMinPrepayAmount) {
        static ScratchSettings disabled() {
            return new ScratchSettings(false, null, null, null, "BOTH", false, false, null, null, null);
        }
    }

    public record BuyerCancelPolicy(boolean cancelOrderEnabled, boolean cancelItemsEnabled) {
        static BuyerCancelPolicy defaults() {
            return new BuyerCancelPolicy(true, true);
        }
    }
}

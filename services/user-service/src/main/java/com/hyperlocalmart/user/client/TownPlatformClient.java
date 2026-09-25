package com.hyperlocalmart.user.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.config.TownServiceProperties;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class TownPlatformClient {

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    @Value
    @Builder
    public static class ReferralConfig {
        boolean enabled;
        BigDecimal referrerRewardAmount;
        BigDecimal refereeRewardAmount;
        String shareBaseUrl;
        String shareMessageTemplate;
    }

    public ReferralConfig getReferralConfig() {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/platform/referral-config")
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return disabled();
            }
            Map<String, Object> data = response.getData();
            return ReferralConfig.builder()
                    .enabled(bool(data.get("enabled")))
                    .referrerRewardAmount(money(data.get("referrerRewardAmount")))
                    .refereeRewardAmount(money(data.get("refereeRewardAmount")))
                    .shareBaseUrl(str(data.get("shareBaseUrl")))
                    .shareMessageTemplate(str(data.get("shareMessageTemplate")))
                    .build();
        } catch (Exception ex) {
            return disabled();
        }
    }

    private static ReferralConfig disabled() {
        return ReferralConfig.builder()
                .enabled(false)
                .referrerRewardAmount(BigDecimal.ZERO)
                .refereeRewardAmount(BigDecimal.ZERO)
                .shareBaseUrl("")
                .shareMessageTemplate("")
                .build();
    }

    private static boolean bool(Object raw) {
        if (raw instanceof Boolean b) {
            return b;
        }
        return "true".equalsIgnoreCase(String.valueOf(raw));
    }

    private static String str(Object raw) {
        return raw == null ? "" : String.valueOf(raw).trim();
    }

    private static BigDecimal money(Object raw) {
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new BigDecimal(s.trim());
        }
        return BigDecimal.ZERO;
    }
}

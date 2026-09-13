package com.hyperlocalmart.catalog.client;

import com.hyperlocalmart.catalog.config.TownServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AdminAuditClient {

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    public void record(String screenKey, String action, String summary, UUID actorId, UUID townId, UUID entityId) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
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
}

package com.hyperlocalmart.catalog.client;

import com.hyperlocalmart.catalog.config.TownServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAuditClient {

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    public void record(String screenKey, String action, String summary, UUID actorId, UUID townId, UUID entityId) {
        record(screenKey, action, summary, actorId, townId, null, entityId, null, null, null);
    }

    public void record(
            String screenKey,
            String action,
            String summary,
            UUID actorId,
            UUID townId,
            String entityType,
            UUID entityId,
            Map<String, Object> beforeSnapshot,
            Map<String, Object> afterSnapshot,
            List<String> changeLines) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("screenKey", screenKey);
            body.put("action", action);
            body.put("changeSummary", summary);
            body.put("actorUserId", actorId);
            body.put("actorRole", "SUPER_ADMIN");
            if (townId != null) {
                body.put("townId", townId);
            }
            if (entityType != null && !entityType.isBlank()) {
                body.put("entityType", entityType);
            }
            if (entityId != null) {
                body.put("entityId", entityId);
            }
            if (beforeSnapshot != null && !beforeSnapshot.isEmpty()) {
                body.put("beforeSnapshot", beforeSnapshot);
            }
            if (afterSnapshot != null && !afterSnapshot.isEmpty()) {
                body.put("afterSnapshot", afterSnapshot);
            }
            if (changeLines != null && !changeLines.isEmpty()) {
                body.put("changeLines", changeLines);
            }
            restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build()
                    .post()
                    .uri("/api/v1/internal/admin-audit")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ex) {
            log.warn("Catalog admin audit failed action={} entityId={}: {}", action, entityId, ex.getMessage());
        }
    }
}

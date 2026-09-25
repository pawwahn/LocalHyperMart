package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Value
@Builder
public class AdminAuditEntryResponse {

    UUID id;
    String screenKey;
    String action;
    String changeSummary;
    List<String> changeLines;
    UUID actorUserId;
    String actorRole;
    UUID townId;
    String entityType;
    UUID entityId;
    Instant createdAt;
    Map<String, Object> beforeSnapshot;
    Map<String, Object> afterSnapshot;
}

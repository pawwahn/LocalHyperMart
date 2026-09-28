package com.hyperlocalmart.town.dto.request;

import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class AdminAuditAppendRequest {

    private String screenKey;
    private String action;
    private String changeSummary;
    private UUID actorUserId;
    private String actorRole;
    private UUID townId;
    private String entityType;
    private UUID entityId;
    private Map<String, Object> beforeSnapshot;
    private Map<String, Object> afterSnapshot;
    private List<String> changeLines;
}

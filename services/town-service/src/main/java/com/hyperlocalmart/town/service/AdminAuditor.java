package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.town.dto.request.AdminAuditAppendRequest;
import com.hyperlocalmart.town.dto.response.AdminAuditEntryResponse;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface AdminAuditor {

    void record(
            String screenKey,
            String action,
            String changeSummary,
            UUID actorUserId,
            String actorRole,
            UUID townId,
            String entityType,
            UUID entityId,
            Object before,
            Object after);

    void record(AdminAuditAppendRequest request);

    PageResponse<AdminAuditEntryResponse> list(
            String screenKey,
            UUID townId,
            int page,
            int size,
            Instant from,
            Instant to,
            String q,
            List<String> actions,
            List<String> summaryPrefixes);

    Map<String, Object> snapshot(Object value);
}

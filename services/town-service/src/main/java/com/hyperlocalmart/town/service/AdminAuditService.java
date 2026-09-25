package com.hyperlocalmart.town.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.town.dto.request.AdminAuditAppendRequest;
import com.hyperlocalmart.town.dto.response.AdminAuditEntryResponse;
import com.hyperlocalmart.town.entity.TownHistory;
import com.hyperlocalmart.town.repository.TownHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuditService implements AdminAuditor {

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

    private final TownHistoryRepository townHistoryRepository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            String screenKey,
            String action,
            String changeSummary,
            UUID actorUserId,
            String actorRole,
            UUID townId,
            String entityType,
            UUID entityId,
            Object before,
            Object after) {
        try {
            if (actorUserId == null || screenKey == null || screenKey.isBlank() || action == null || action.isBlank()) {
                return;
            }
            TownHistory row = TownHistory.builder()
                    .screenKey(screenKey.trim())
                    .action(action.trim())
                    .changeSummary(trimTo(changeSummary, 500))
                    .actorUserId(actorUserId)
                    .actorRole(trimTo(actorRole, 50))
                    .townId(townId)
                    .entityType(trimTo(entityType, 100))
                    .entityId(entityId)
                    .beforeSnapshot(asMap(before))
                    .afterSnapshot(asMap(after))
                    .createdAt(Instant.now())
                    .build();
            townHistoryRepository.save(row);
        } catch (Exception ex) {
            log.warn("Admin audit write failed screen={} action={}: {}", screenKey, action, ex.getMessage());
        }
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AdminAuditAppendRequest request) {
        if (request == null) {
            return;
        }
        record(
                request.getScreenKey(),
                request.getAction(),
                request.getChangeSummary(),
                request.getActorUserId(),
                request.getActorRole(),
                request.getTownId(),
                request.getEntityType(),
                request.getEntityId(),
                request.getBeforeSnapshot(),
                request.getAfterSnapshot());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AdminAuditEntryResponse> list(
            String screenKey,
            UUID townId,
            int page,
            int size,
            Instant from,
            Instant to,
            String q) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        int safePage = Math.max(page, 0);
        var pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        var result = townHistoryRepository.findAll(filter(screenKey, townId, from, to, q), pageable);
        return PageResponse.<AdminAuditEntryResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    private static Specification<TownHistory> filter(
            String screenKey,
            UUID townId,
            Instant from,
            Instant to,
            String q) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("screenKey"), screenKey));
            if (townId != null) {
                predicates.add(cb.equal(root.get("townId"), townId));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }
            String needle = q == null ? "" : q.trim().replace("%", "").replace("_", "");
            if (!needle.isEmpty()) {
                predicates.add(cb.like(cb.lower(cb.coalesce(root.get("changeSummary"), "")),
                        "%" + needle.toLowerCase() + "%"));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    @Override
    public Map<String, Object> snapshot(Object value) {
        return asMap(value);
    }

    private AdminAuditEntryResponse toResponse(TownHistory row) {
        String summary = row.getChangeSummary();
        Map<String, Object> before = row.getBeforeSnapshot();
        Map<String, Object> after = row.getAfterSnapshot();
        if (before != null && after != null && !before.isEmpty() && !after.isEmpty()) {
            if ("town-settings".equals(row.getScreenKey())) {
                summary = TownConfigService.settingsChangeSummary(null, before, after);
            } else if ("settings".equals(row.getScreenKey())) {
                summary = PlatformSettingsService.settingsChangeSummary(before, after);
            } else if (summary == null || summary.isBlank()
                    || "Updated settings".equalsIgnoreCase(summary.trim())) {
                summary = TownConfigService.settingsChangeSummary(null, before, after);
            }
        } else if (summary == null || summary.isBlank() || "Updated settings".equalsIgnoreCase(summary.trim())) {
            summary = TownConfigService.settingsChangeSummary(null, before, after);
        }
        List<String> changeLines = buildChangeLines(row, before, after, summary);
        return AdminAuditEntryResponse.builder()
                .id(row.getId())
                .screenKey(row.getScreenKey())
                .action(row.getAction())
                .changeSummary(summary)
                .changeLines(changeLines)
                .actorUserId(row.getActorUserId())
                .actorRole(row.getActorRole())
                .townId(row.getTownId())
                .entityType(row.getEntityType())
                .entityId(row.getEntityId())
                .createdAt(row.getCreatedAt())
                .beforeSnapshot(before)
                .afterSnapshot(after)
                .build();
    }

    private List<String> buildChangeLines(
            TownHistory row,
            Map<String, Object> before,
            Map<String, Object> after,
            String summary) {
        if ("town-settings".equals(row.getScreenKey()) && before != null && after != null) {
            List<String> parts = TownConfigService.settingsChangeParts(before, after);
            if (!parts.isEmpty()) {
                return parts;
            }
        }
        if ("settings".equals(row.getScreenKey()) && before != null && after != null) {
            List<String> parts = PlatformSettingsService.settingsChangeParts(before, after);
            if (!parts.isEmpty()) {
                return parts;
            }
        }
        String text = summary == null ? "" : summary.trim();
        if (text.isEmpty()) {
            return List.of();
        }
        return List.of(text);
    }

    private Map<String, Object> asMap(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Map<?, ?> raw) {
            Map<String, Object> copy = new LinkedHashMap<>();
            raw.forEach((k, v) -> {
                if (k != null) {
                    copy.put(String.valueOf(k), v);
                }
            });
            return copy;
        }
        try {
            return objectMapper.convertValue(value, MAP);
        } catch (IllegalArgumentException ex) {
            return Map.of("value", String.valueOf(value));
        }
    }

    private static String trimTo(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }
}

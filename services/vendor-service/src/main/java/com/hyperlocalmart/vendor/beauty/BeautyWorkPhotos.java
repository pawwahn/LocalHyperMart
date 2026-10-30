package com.hyperlocalmart.vendor.beauty;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.response.BeautyArtistResponse;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class BeautyWorkPhotos {

    public static final int MAX = 10;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private BeautyWorkPhotos() {}

    public static List<UUID> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            List<String> tokens = MAPPER.readValue(raw.trim(), STRING_LIST);
            if (tokens == null || tokens.isEmpty()) {
                return List.of();
            }
            List<UUID> out = new ArrayList<>();
            for (String token : tokens) {
                if (token == null || token.isBlank()) {
                    continue;
                }
                out.add(UUID.fromString(token.trim()));
            }
            return out.size() > MAX ? out.subList(0, MAX) : out;
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Work photo ids must be valid UUIDs");
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Work photos could not be read");
        }
    }

    public static String serialize(List<UUID> ids) {
        List<UUID> normalized = normalize(ids);
        try {
            List<String> tokens = normalized.stream().map(UUID::toString).toList();
            return MAPPER.writeValueAsString(tokens);
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not save work photos");
        }
    }

    public static List<UUID> normalize(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        if (ids.size() > MAX) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "You can upload up to " + MAX + " work photos");
        }
        Set<UUID> seen = new LinkedHashSet<>();
        for (UUID id : ids) {
            if (id == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Work photo id is required");
            }
            if (!seen.add(id)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Duplicate work photo");
            }
        }
        return List.copyOf(seen);
    }

    public static List<BeautyArtistResponse.WorkPhoto> toRows(String raw) {
        return parse(raw).stream()
                .map(BeautyWorkPhotos::toRow)
                .toList();
    }

    public static BeautyArtistResponse.WorkPhoto toRow(UUID id) {
        return BeautyArtistResponse.WorkPhoto.builder()
                .mediaId(id)
                .url("/api/v1/media/" + id + "/content")
                .build();
    }

    public static String mediaUrl(UUID id) {
        return "/api/v1/media/" + id + "/content";
    }

    public static String contextLabel() {
        return "BEAUTY_WORK";
    }

    public static boolean isWorkContext(String context) {
        return contextLabel().equalsIgnoreCase(context == null ? "" : context.trim());
    }
}
